// ============================================================================
// Market Data Routes
// ----------------------------------------------------------------------------
// All live market data (index quotes, option chain) comes exclusively from
// Upstox via upstox.service.js. Strategies are curated content stored in
// the PostgreSQL database.
//
// If Upstox is unavailable or the token is invalid, routes return HTTP 503
// with a structured error — they NEVER fabricate or fall back to mock data.
// ============================================================================

import { Router } from 'express';
import { pool } from '../config/db.js';
import upstoxService from '../services/upstox.service.js';
import { stopActiveAlgosForMarketDisconnect } from '../algo/runner.js';

const router = Router();

// ── Serialisers ──────────────────────────────────────────────────────────────

function serializeStrategy(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    regimeFit: row.regime_fit,
    buyLeg: row.buy_leg,
    sellLeg: row.sell_leg,
    maxLoss: Number(row.max_loss),
    maxProfit: Number(row.max_profit),
    breakeven: Number(row.breakeven),
    holdingPeriod: row.holding_period,
    riskPercent: Number(row.risk_percent),
    exceedsRiskLimit: row.exceeds_risk_limit,
    verdict: row.verdict,
    overview: row.overview,
    regime: row.regime,
    entryRules: row.entry_rules,
    riskRules: row.risk_rules,
    historicalNote: 'No verified backtest result is available for this setup. Run a backtest with supplied market data to measure it.',
    currentSignal: row.current_signal,
    signalVerdict: row.signal_verdict,
    disclaimer: row.disclaimer,
  };
}

// ── Helper: format a Date as a human-readable IST string ────────────────────
function formatTimestamp(date = new Date()) {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/market/indices
 * Returns live index snapshots for NIFTY, BANKNIFTY, and FINNIFTY.
 * Source: Upstox /market-quote/quotes (live, delayed by exchange rules).
 *
 * On any Upstox failure returns HTTP 503 — never fabricates data.
 */
router.get('/market/indices', async (req, res, next) => {
  try {
    const results = await upstoxService.getIndexQuotes(['NIFTY', 'BANKNIFTY', 'FINNIFTY']);
    const liveResults = results.filter((r) => r.data !== null);

    if (liveResults.length === 0) {
      const limitations = results.map((r) => r.limitation || r.error).filter(Boolean);
      return res.status(503).json({
        indices: [],
        source: 'UPSTOX',
        error: 'Upstox market data is currently unavailable.',
        limitations,
      });
    }

    const indices = liveResults.map((r) => {
      const d = r.data;
      return {
        symbol:        r.symbol,
        name:          d.name,
        price:         d.price,
        change:        d.change,
        changePercent: d.changePercent,
        // Upstox index quotes do not include VIX — reported as null.
        vix:           null,
        // KEPWE analytics (IQ Score, verdict, trend, regime, etc.) are not
        // provided by Upstox. They are explicitly null rather than fabricated.
        iqScore:       null,
        iqStatus:      null,
        verdict:       null,
        verdictTitle:  null,
        verdictReason: null,
        confidence:    null,
        trend:         null,
        momentum:      null,
        volatility:    null,
        regime:        null,
        support:       null,
        resistance:    null,
        advanceDecline: null,
        sgxCues:       null,
        ivPercentile:  null,
        lastUpdated:   formatTimestamp(),
      };
    });

    return res.json({ indices, source: 'UPSTOX' });
  } catch (err) {
    await stopActiveAlgosForMarketDisconnect(
      'Market data provider failure; active algos stopped and new orders blocked',
      { route: '/market/indices', provider: 'UPSTOX' },
    );
    next(err);
  }
});

/**
 * GET /api/market/indices/:symbol
 * Returns a live snapshot for a single index (NIFTY, BANKNIFTY, or FINNIFTY).
 * Source: Upstox.
 */
router.get('/market/indices/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const results = await upstoxService.getIndexQuotes([symbol.toUpperCase()]);
    const liveResult = results.find((r) => r.data !== null);

    if (!liveResult) {
      const limitation = results[0]?.limitation || results[0]?.error;
      return res.status(503).json({
        index: null,
        source: 'UPSTOX',
        error: limitation || `Upstox market data unavailable for ${symbol.toUpperCase()}.`,
      });
    }

    const d = liveResult.data;
    return res.json({
      index: {
        symbol:        liveResult.symbol,
        name:          d.name,
        price:         d.price,
        change:        d.change,
        changePercent: d.changePercent,
        vix:           null,
        iqScore:       null,
        iqStatus:      null,
        verdict:       null,
        verdictTitle:  null,
        verdictReason: null,
        confidence:    null,
        trend:         null,
        momentum:      null,
        volatility:    null,
        regime:        null,
        support:       null,
        resistance:    null,
        advanceDecline: null,
        sgxCues:       null,
        ivPercentile:  null,
        lastUpdated:   formatTimestamp(),
      },
      source: 'UPSTOX',
    });
  } catch (err) {
    await stopActiveAlgosForMarketDisconnect(
      'Market data provider failure; active algos stopped and new orders blocked',
      { route: '/market/indices/:symbol', provider: 'UPSTOX' },
    );
    next(err);
  }
});

/**
 * GET /api/market/option-chain?symbol=NIFTY[&expiryDate=YYYY-MM-DD]
 * Returns a live option chain from Upstox.
 * If expiryDate is omitted, the nearest active expiry is auto-resolved.
 *
 * On any Upstox failure returns HTTP 503 — never fabricates data.
 */
router.get('/market/option-chain', async (req, res, next) => {
  try {
    const symbol = (req.query.symbol || 'NIFTY').toUpperCase();
    const expiryDate = req.query.expiryDate || undefined;

    const result = await upstoxService.getOptionChain(symbol, expiryDate);

    if (!result.data || result.data.length === 0) {
      return res.status(503).json({
        optionChain: [],
        source: 'UPSTOX',
        error: `Upstox returned no option chain data for ${symbol}.`,
      });
    }

    // The service already normalises field names — pass them through directly.
    return res.json({
      optionChain: result.data,
      source:      'UPSTOX',
      expiryDate:  result.expiryDate,
      spotPrice:   result.spotPrice,
    });
  } catch (err) {
    await stopActiveAlgosForMarketDisconnect(
      'Market data provider failure; active algos stopped and new orders blocked',
      { route: '/market/option-chain', provider: 'UPSTOX' },
    );
    next(err);
  }
});

/**
 * GET /api/market/strategies
 * Returns curated, active market strategies from the database.
 * This endpoint does not depend on Upstox and is always available.
 */
router.get('/market/strategies', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, type, description, regime_fit, buy_leg, sell_leg,
              max_loss, max_profit, breakeven, win_probability, holding_period,
              risk_percent, exceeds_risk_limit, verdict, overview, regime,
              entry_rules, risk_rules, historical_note, current_signal,
              signal_verdict, disclaimer
       FROM market_strategies
       WHERE is_active = TRUE
       ORDER BY sort_order, name`
    );
    return res.json({ strategies: result.rows.map(serializeStrategy), source: 'DATABASE' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/market/strategies/:id
 * Returns a single strategy by ID.
 */
router.get('/market/strategies/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, type, description, regime_fit, buy_leg, sell_leg,
              max_loss, max_profit, breakeven, win_probability, holding_period,
              risk_percent, exceeds_risk_limit, verdict, overview, regime,
              entry_rules, risk_rules, historical_note, current_signal,
              signal_verdict, disclaimer
       FROM market_strategies WHERE id = $1 AND is_active = TRUE`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    return res.json({ strategy: serializeStrategy(result.rows[0]), source: 'DATABASE' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/market/health
 * Returns Upstox connectivity status for monitoring/debugging.
 * Does NOT expose the token value or any credentials.
 */
router.get('/market/health', (req, res) => {
  const configured = Boolean(process.env.UPSTOX_ACCESS_TOKEN?.trim());
  res.json({
    ok: configured,
    source: 'UPSTOX',
    message: configured
      ? 'Upstox access token is configured.'
      : 'UPSTOX_ACCESS_TOKEN is not set.',
  });
});

export default router;
