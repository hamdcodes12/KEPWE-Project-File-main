import { pool } from '../config/db.js';
import upstoxService from '../services/upstox.service.js';
import { calculatePaperPnl, exitCosts, resolvePaperExit } from './paper-engine.js';
import { comparePaperLedgers, killSwitchReasons } from './reconciliation.js';

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_SLIPPAGE_BPS = 2;
const DEFAULT_CHARGES_BPS = 5;

async function recordActivity(userId, eventType, message, metadata = {}) {
  await pool.query(
    `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [userId, eventType, message, JSON.stringify(metadata)]
  );
}

async function recordRiskEvent(userId, eventType, reason, metadata = {}) {
  const recent = await pool.query(
    `SELECT 1 FROM risk_events
     WHERE user_id = $1 AND event_type = $2 AND created_at >= NOW() - INTERVAL '5 minutes'
     LIMIT 1`,
    [userId, eventType]
  );
  if (recent.rows.length > 0) return;
  await pool.query(
    `INSERT INTO risk_events (user_id, event_type, reason, severity, metadata)
     VALUES ($1, $2, $3, 'HIGH', $4::jsonb)`,
    [userId, eventType, reason, JSON.stringify(metadata)]
  );
  await recordActivity(userId, 'RISK_EVENT', reason, { eventType, ...metadata });
}

async function closePaperTrade(trade, exitPrice, reason, timestamp) {
  const costs = exitCosts({
    exitPrice,
    quantity: trade.quantity,
    slippageBps: DEFAULT_SLIPPAGE_BPS,
    chargesBps: DEFAULT_CHARGES_BPS,
  });
  const pnl = calculatePaperPnl({
    side: trade.side,
    entryPrice: trade.entry_price,
    exitPrice,
    quantity: trade.quantity,
    entrySlippage: trade.slippage,
    entryCharges: trade.charges,
    exitSlippage: costs.slippage,
    exitCharges: costs.charges,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT * FROM paper_trades WHERE id = $1 AND status = 'OPEN' FOR UPDATE`,
      [trade.id]
    );
    if (!locked.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const current = locked.rows[0];
    const updated = await client.query(
      `UPDATE paper_trades
       SET exit_price = $2, charges = $3, pnl = $4, status = 'CLOSED', closed_at = $5
       WHERE id = $1
       RETURNING *`,
      [
        current.id,
        exitPrice,
        pnl.charges,
        pnl.pnl,
        timestamp || new Date(),
      ]
    );
    await client.query(
      `UPDATE algo_positions
       SET current_price = $2, pnl = $3, status = 'CLOSED'
       WHERE user_id = $1 AND symbol = $4 AND side = $5 AND status = 'OPEN'`,
      [current.user_id, exitPrice, pnl.pnl, current.instrument, current.side]
    );
    await client.query(
      `INSERT INTO algo_trades
       (user_id, strategy_id, symbol, side, entry_price, exit_price, quantity, pnl, status, traded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PAPER', $9)`,
      [
        current.user_id,
        current.strategy_id,
        current.instrument,
        current.side,
        current.entry_price,
        exitPrice,
        current.quantity,
        pnl.pnl,
        timestamp || new Date(),
      ]
    );
    await client.query('COMMIT');
    return { ...updated.rows[0], exitReason: reason, ...pnl };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function stopUser(userId, eventType, reason, metadata = {}) {
  await pool.query(
    `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
     WHERE user_id = $1 AND status <> 'STOPPED'`,
    [userId]
  );
  await recordRiskEvent(userId, eventType, reason, metadata);
}

export async function stopActiveAlgosForMarketDisconnect(
  reason = 'Market data disconnected; new orders stopped',
  metadata = {},
) {
  const active = await pool.query(`SELECT user_id FROM algo_states WHERE status = 'ACTIVE'`);
  await Promise.all(active.rows.map((row) => stopUser(
    row.user_id,
    'MARKET_DATA_DISCONNECT',
    reason,
    metadata,
  )));
  return active.rows.length;
}

async function reconcilePaperUser(userId) {
  const [trades, positions] = await Promise.all([
    pool.query(
      `SELECT instrument, side, quantity, entry_price
       FROM paper_trades WHERE user_id = $1 AND status = 'OPEN'`,
      [userId]
    ),
    pool.query(
      `SELECT symbol AS instrument, side, quantity, entry_price
       FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`,
      [userId]
    ),
  ]);
  const result = comparePaperLedgers(trades.rows, positions.rows);
  if (!result.matched) {
    await stopUser(userId, 'POSITION_MISMATCH', 'Internal paper ledgers do not reconcile; new orders stopped', result);
  }
  return result;
}

export async function runPaperMarketCycle({ timestamp = new Date(), price } = {}) {
  let marketPrice = Number(price);
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
    const quotes = await upstoxService.getIndexQuotes(['NIFTY']);
    marketPrice = Number(quotes[0]?.data?.price);
  }
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
    const error = new Error('Verified NIFTY market price is unavailable');
    await stopActiveAlgosForMarketDisconnect();
    throw error;
  }

  const active = await pool.query(
    `SELECT s.user_id, a.trading_capital, a.risk_per_trade, a.daily_loss_limit,
            a.max_consecutive_losses, a.max_trades_per_day
     FROM algo_states s
     JOIN algo_settings a ON a.user_id = s.user_id
     JOIN paper_trade_settings p ON p.user_id = s.user_id
     WHERE s.status = 'ACTIVE' AND p.paper_trade_mode = TRUE`
  );
  const closed = [];
  for (const row of active.rows) {
    const openTrades = await pool.query(
      `SELECT * FROM paper_trades WHERE user_id = $1 AND status = 'OPEN'`,
      [row.user_id]
    );
    for (const trade of openTrades.rows) {
      const exit = resolvePaperExit({
        side: trade.side,
        low: marketPrice,
        high: marketPrice,
        close: marketPrice,
        stopLoss: trade.stop_loss,
        target: trade.target,
        timestamp,
      });
      if (exit) {
        const result = await closePaperTrade(trade, exit.exitPrice, exit.reason, timestamp);
        if (result) {
          closed.push({ userId: row.user_id, tradeId: trade.id, reason: exit.reason, pnl: result.pnl });
          await recordActivity(row.user_id, 'PAPER_POSITION_CLOSED', `Paper position closed by ${exit.reason}`, {
            tradeId: trade.id,
            price: exit.exitPrice,
            pnl: result.pnl,
          });
        }
      } else {
        const markCosts = exitCosts({
          exitPrice: marketPrice,
          quantity: trade.quantity,
          slippageBps: DEFAULT_SLIPPAGE_BPS,
          chargesBps: DEFAULT_CHARGES_BPS,
        });
        const unrealized = calculatePaperPnl({
          side: trade.side,
          entryPrice: trade.entry_price,
          exitPrice: marketPrice,
          quantity: trade.quantity,
          entrySlippage: trade.slippage,
          entryCharges: trade.charges,
          exitSlippage: markCosts.slippage,
          exitCharges: markCosts.charges,
        });
        await pool.query(
          `UPDATE algo_positions
           SET current_price = $2, pnl = $3
           WHERE user_id = $1 AND symbol = $4 AND side = $5 AND status = 'OPEN'`,
          [row.user_id, marketPrice, unrealized.pnl, trade.instrument, trade.side]
        );
      }
    }

    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE opened_at::date = CURRENT_DATE)::int AS today_trades,
         COALESCE(SUM(pnl) FILTER (WHERE status = 'CLOSED' AND closed_at::date = CURRENT_DATE), 0) AS daily_pnl
       FROM paper_trades WHERE user_id = $1`,
      [row.user_id]
    );
    const recent = await pool.query(
      `SELECT pnl FROM paper_trades WHERE user_id = $1 AND status = 'CLOSED'
       ORDER BY closed_at DESC LIMIT 20`,
      [row.user_id]
    );
    let consecutiveLosses = 0;
    for (const trade of recent.rows) {
      if (Number(trade.pnl) < 0) consecutiveLosses += 1;
      else break;
    }
    const riskPerTradeAmount = Number(row.trading_capital) * (Number(row.risk_per_trade) / 100);
    const maxDailyLoss = Number(row.daily_loss_limit) > 0
      ? Number(row.daily_loss_limit)
      : riskPerTradeAmount * 2;
    const reasons = killSwitchReasons({
      dailyLoss: Math.abs(Math.min(0, Number(stats.rows[0].daily_pnl))),
      maxDailyLoss,
      consecutiveLosses,
      maxConsecutiveLosses: row.max_consecutive_losses,
    });
    if (reasons.length > 0) {
      await stopUser(row.user_id, 'KILL_SWITCH', `Automatic kill switch: ${reasons.join(', ')}`, { reasons });
    }
    await reconcilePaperUser(row.user_id);
  }
  return { price: marketPrice, activeUsers: active.rows.length, closed };
}

let runnerTimer = null;
let initialRunnerTimer = null;

export function startAlgoRunner(intervalMs = Number(process.env.ALGO_RUNNER_INTERVAL_MS || DEFAULT_INTERVAL_MS)) {
  if (runnerTimer) return runnerTimer;
  const tick = () => runPaperMarketCycle().catch((error) => {
    console.error(`[algo-runner] ${error.message}`);
  });
  const effectiveInterval = Math.max(10_000, intervalMs);
  runnerTimer = setInterval(tick, effectiveInterval);
  runnerTimer.unref?.();
  // Do not start a long-running provider request inline during server startup.
  // A slow first quote can otherwise finish after a paper order is created and
  // close that order with an unrelated price before the caller's next update.
  // The first poll is still automatic, but follows the same cadence as later
  // polls unless explicitly overridden for a deployment.
  const configuredInitialDelay = Number(process.env.ALGO_RUNNER_INITIAL_DELAY_MS);
  const initialDelay = Number.isFinite(configuredInitialDelay)
    ? Math.max(0, configuredInitialDelay)
    : effectiveInterval;
  initialRunnerTimer = setTimeout(tick, initialDelay);
  initialRunnerTimer.unref?.();
  return runnerTimer;
}

export function stopAlgoRunner() {
  if (runnerTimer) clearInterval(runnerTimer);
  if (initialRunnerTimer) clearTimeout(initialRunnerTimer);
  runnerTimer = null;
  initialRunnerTimer = null;
}