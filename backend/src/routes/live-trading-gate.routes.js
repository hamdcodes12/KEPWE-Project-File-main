/**
 * KEPWE LIVE TRADING SAFETY GATES
 * 
 * This router enforces ALL safety prerequisites before any live order execution.
 * Every check must PASS before orders are allowed.
 * 
 * Routes:
 * - POST /api/live/deployment/validate      - Run full production readiness check
 * - GET  /api/live/status                   - Get current live trading status
 * - POST /api/live/enable                   - Enable live trading (after gate passes)
 * - POST /api/live/disable                  - Disable live trading (emergency stop)
 * - POST /api/live/emergency-stop           - Force kill all positions
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireFeature } from '../middleware/auth.js';
import { FEATURES } from '../middleware/feature-gate.js';
import { getBrokerAdapter } from '../algo/broker-adapters.js';
import { validateNiftyScalpingDeploymentGate } from '../services/nifty-scalping-strategy.service.js';
import { NIFTY_QUANT_STRATEGY } from '../services/quant-engine.service.js';
import { evaluateRisk } from '../algo/risk-engine.js';
import { decryptBrokerSecret } from '../services/broker-token.service.js';
import { tryCreateQuantNotification } from '../services/quant-notification.service.js';

const router = Router();

function extractDhanNiftyQuote(payload) {
  const data = payload?.data || payload || {};
  const quote = data?.IDX_I?.['13'] || {};
  const ltp = Number(quote.last_price ?? quote.ltp);
  const rawLtt = quote.ltt ?? quote.last_trade_time ?? quote.lastTradeTime ?? quote.timestamp;
  const numericLtt = Number(rawLtt);
  const ltt = Number.isFinite(numericLtt)
    ? (numericLtt < 1e12 ? numericLtt * 1000 : numericLtt)
    : new Date(rawLtt || '').getTime();
  return { ltp, ltt };
}

function freshDhanLtt(value, now = Date.now(), maxAgeMs = 90_000) {
  return Number.isFinite(value) && value <= now && now - value <= maxAgeMs;
}

/**
 * POST /api/live/deployment/validate
 * 
 * Comprehensive production readiness check.
 * Returns PASS/FAIL for each safety prerequisite.
 * Only after ALL PASS can trading be enabled.
 */
router.post('/live/deployment/validate', requireAuth, requireFeature(FEATURES.LIVE_EXECUTION), async (req, res, next) => {
  try {
    const userId = req.userId;
    const checks = {};

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 1: DHAN BROKER SESSION
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const brokerRes = await pool.query(
        `SELECT ba.id, ba.broker, ba.status, ba.client_id, bot.access_token_ciphertext, bot.token_expires_at
         FROM broker_accounts ba
         LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
         WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
         ORDER BY bot.created_at DESC LIMIT 1`,
        [userId]
      );

      if (brokerRes.rows.length === 0 || !brokerRes.rows[0].access_token_ciphertext || brokerRes.rows[0].status !== 'CONNECTED' || brokerRes.rows[0].connection_mode !== 'LIVE') {
        checks.dhanSession = {
          passed: false,
          reason: 'No Dhan broker account found or access token missing',
          action: 'Connect your Dhan account through the dashboard'
        };
      } else {
        const broker = brokerRes.rows[0];
        try {
          const accessToken = decryptBrokerSecret(broker.access_token_ciphertext);
          const adapter = getBrokerAdapter('DHAN', 'LIVE', {
            dhanClientId: broker.client_id,
            accessToken,
            tokenExpiresAt: broker.token_expires_at,
          });
          
          await adapter.validateSession();
          const profile = await adapter.getProfile();
          if (String(profile.clientId || '') !== String(broker.client_id || '')) {
            throw new Error('Dhan profile identity does not match the stored client ID');
          }
          
          checks.dhanSession = {
            passed: true,
            clientId: broker.client_id,
            accountHolder: profile.clientId || broker.client_id,
            reason: 'Dhan session validated successfully'
          };
        } catch (err) {
          checks.dhanSession = {
            passed: false,
            reason: `Session validation failed: ${err.message}`,
            action: 'Reconnect your Dhan account - session may have expired'
          };
        }
      }
    } catch (err) {
      checks.dhanSession = {
        passed: false,
        reason: `Database error: ${err.message}`,
        action: 'Check database connectivity'
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 2: STATIC IP WHITELISTED
    // ─────────────────────────────────────────────────────────────────────────
    const configuredIP = process.env.DHAN_STATIC_IP;
    checks.staticIp = {
      passed: Boolean(configuredIP),
      configuredIP,
      reason: configuredIP 
        ? `Static IP configured: ${configuredIP}` 
        : 'DHAN_STATIC_IP not set in environment',
      action: configuredIP 
        ? 'Verify IP is whitelisted in Dhan API settings'
        : 'Set DHAN_STATIC_IP environment variable'
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 3: MARKET DATA FEED
    // ─────────────────────────────────────────────────────────────────────────
    if (checks.dhanSession.passed && checks.staticIp.passed) {
      try {
        const brokerRes = await pool.query(
          `SELECT ba.client_id, bot.access_token_ciphertext, bot.token_expires_at
           FROM broker_accounts ba
           LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
           WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
           ORDER BY bot.created_at DESC LIMIT 1`,
          [userId]
        );

        if (brokerRes.rows.length > 0 && brokerRes.rows[0].access_token_ciphertext) {
          const broker = brokerRes.rows[0];
          const accessToken = decryptBrokerSecret(broker.access_token_ciphertext);
          const adapter = getBrokerAdapter('DHAN', 'LIVE', {
            dhanClientId: broker.client_id,
            accessToken,
            tokenExpiresAt: broker.token_expires_at,
          });

          try {
            const marketData = await adapter.getMarketData({
              exchange: 'IDX_I',
              symbolToken: '13' // Dhan NIFTY 50 index security ID
            });
            const quote = extractDhanNiftyQuote(marketData);
            if (!Number.isFinite(quote.ltp) || quote.ltp <= 0 || !freshDhanLtt(quote.ltt)) {
              throw new Error('Dhan returned missing, stale, or future NIFTY IDX_I/13 market data');
            }
            checks.marketData = {
              passed: true,
              exchange: 'IDX_I',
              securityId: '13',
              niftyLtp: quote.ltp,
              niftyLtt: new Date(quote.ltt).toISOString(),
              reason: 'Real-time market data feed active'
            };
          } catch (err) {
            checks.marketData = {
              passed: false,
              reason: `Market data fetch failed: ${err.message}`,
              action: 'Check market hours and broker connectivity'
            };
          }
        }
      } catch (err) {
        checks.marketData = {
          passed: false,
          reason: `Market data check error: ${err.message}`
        };
      }
    } else {
      checks.marketData = {
        passed: false,
        reason: 'Cannot verify market data without valid broker session',
        dependsOn: ['dhanSession', 'staticIp']
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 4: RISK ENGINE
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const settingsRes = await pool.query(
        `SELECT trading_capital, risk_per_trade, daily_loss_limit, max_trades_per_day, max_consecutive_losses
         FROM algo_settings
         WHERE user_id = $1`,
        [userId]
      );

      if (settingsRes.rows.length === 0) {
        checks.riskEngine = {
          passed: false,
          reason: 'No risk profile configured',
          action: 'Configure risk settings in the dashboard'
        };
      } else {
        const settings = settingsRes.rows[0];
        const tradingCapital = Number(settings.trading_capital);
        const riskPerTrade = Number(settings.risk_per_trade);

        if (tradingCapital <= 0 || riskPerTrade <= 0 || riskPerTrade > 5) {
          checks.riskEngine = {
            passed: false,
            reason: `Invalid risk settings: capital=${tradingCapital}, risk=${riskPerTrade}%`,
            action: 'Set trading capital > 0 and risk per trade between 0.5% and 5%'
          };
        } else {
          const brokerRes = await pool.query(
            `SELECT ba.client_id, bot.access_token_ciphertext, bot.token_expires_at
             FROM broker_accounts ba
             LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
             WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
             ORDER BY bot.created_at DESC LIMIT 1`,
            [userId]
          );
          const broker = brokerRes.rows[0];
          const accessToken = broker?.access_token_ciphertext
            ? decryptBrokerSecret(broker.access_token_ciphertext)
            : null;
          const adapter = accessToken
            ? getBrokerAdapter('DHAN', 'LIVE', {
              dhanClientId: broker.client_id,
              accessToken,
              tokenExpiresAt: broker.token_expires_at,
            })
            : null;
          const margin = adapter ? await adapter.getMargin() : null;
          const availableMargin = Number(margin?.available);

          // Test risk evaluation using the configured NIFTY lot size and live margin.
          const testCandidate = { signal: 'BUY_CE', price: 100, stopLoss: 75 };
          const riskEval = evaluateRisk({
            candidate: testCandidate,
            settings: {
              tradingCapital,
              riskPerTrade,
              maxTradesPerDay: settings.max_trades_per_day || 3,
              maxConsecutiveLosses: settings.max_consecutive_losses || 2,
              dailyLossLimit: settings.daily_loss_limit || 0
            },
            stats: { dailyLoss: 0, todayTrades: 0, consecutiveLosses: 0 },
            existingPosition: false,
            brokerHealthy: true,
            systemHealthy: true,
            duplicateOrder: false,
            slippage: 0,
            maxSlippage: 2,
            lotSize: NIFTY_QUANT_STRATEGY.lotSize,
            availableMargin,
            brokerLimit: Number.MAX_SAFE_INTEGER,
            exposureLimit: Number.MAX_SAFE_INTEGER
          });

          checks.riskEngine = {
            passed: riskEval.approved,
            tradingCapital,
            riskPerTrade,
            reason: riskEval.approved 
              ? 'Risk engine operational and test evaluation passed'
              : `Risk engine test failed: ${riskEval.reason}`
          };
        }
      }
    } catch (err) {
      checks.riskEngine = {
        passed: false,
        reason: `Risk engine check error: ${err.message}`
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 5: OMS DATABASE
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const tablesCheck = await pool.query(`
        SELECT 
          EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'algo_orders') as has_orders,
          EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'algo_positions') as has_positions,
          EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'algo_trades') as has_trades,
          EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'execution_events') as has_events
      `);

      const tables = tablesCheck.rows[0];
      checks.omsDatabase = {
        passed: tables.has_orders && tables.has_positions && tables.has_trades && tables.has_events,
        reason: tables.has_orders && tables.has_positions && tables.has_trades && tables.has_events
          ? 'All OMS tables present and accessible'
          : 'Missing required OMS tables',
        action: tables.has_orders && tables.has_positions && tables.has_trades && tables.has_events
          ? null
          : 'Run database migrations'
      };
    } catch (err) {
      checks.omsDatabase = {
        passed: false,
        reason: `OMS database check error: ${err.message}`
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 6: ORDER EXECUTION API
    // ─────────────────────────────────────────────────────────────────────────
    if (checks.dhanSession.passed) {
      try {
        const brokerRes = await pool.query(
          `SELECT ba.client_id, bot.access_token_ciphertext, bot.token_expires_at
           FROM broker_accounts ba
           LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
           WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
           ORDER BY bot.created_at DESC LIMIT 1`,
          [userId]
        );

        if (brokerRes.rows.length > 0 && brokerRes.rows[0].access_token_ciphertext) {
          const broker = brokerRes.rows[0];
          const accessToken = decryptBrokerSecret(broker.access_token_ciphertext);
          const adapter = getBrokerAdapter('DHAN', 'LIVE', {
            dhanClientId: broker.client_id,
            accessToken,
            tokenExpiresAt: broker.token_expires_at,
          });

          const capabilities = adapter.capabilities();
          checks.orderApi = {
            passed: capabilities.orderPlacement === true,
            reason: capabilities.orderPlacement === true
              ? 'Order placement capability verified'
              : 'Order placement not supported by adapter'
          };
        }
      } catch (err) {
        checks.orderApi = {
          passed: false,
          reason: `Order API check error: ${err.message}`
        };
      }
    } else {
      checks.orderApi = {
        passed: false,
        reason: 'Cannot verify order API without valid broker session',
        dependsOn: ['dhanSession']
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 7: POSITION SYNC
    // ─────────────────────────────────────────────────────────────────────────
    if (checks.dhanSession.passed) {
      try {
        const brokerRes = await pool.query(
          `SELECT ba.client_id, bot.access_token_ciphertext, bot.token_expires_at
           FROM broker_accounts ba
           LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
           WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
           ORDER BY bot.created_at DESC LIMIT 1`,
          [userId]
        );

        if (brokerRes.rows.length > 0 && brokerRes.rows[0].access_token_ciphertext) {
          const broker = brokerRes.rows[0];
          const accessToken = decryptBrokerSecret(broker.access_token_ciphertext);
          const adapter = getBrokerAdapter('DHAN', 'LIVE', {
            dhanClientId: broker.client_id,
            accessToken,
            tokenExpiresAt: broker.token_expires_at,
          });

          try {
            const positions = await adapter.getPositions();
            checks.positionSync = {
              passed: true,
              brokerPositions: positions.length,
              reason: `Successfully fetched ${positions.length} position(s) from broker`
            };
          } catch (err) {
            checks.positionSync = {
              passed: false,
              reason: `Position fetch failed: ${err.message}`
            };
          }
        }
      } catch (err) {
        checks.positionSync = {
          passed: false,
          reason: `Position sync check error: ${err.message}`
        };
      }
    } else {
      checks.positionSync = {
        passed: false,
        reason: 'Cannot verify position sync without valid broker session',
        dependsOn: ['dhanSession']
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 8: P&L CALCULATION
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const tradesCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'algo_trades' 
          AND column_name IN ('entry_price', 'exit_price', 'quantity', 'pnl', 'charges', 'net_pnl')
      `);

      checks.pnlCalculation = {
        passed: tradesCheck.rows.length === 6,
        reason: tradesCheck.rows.length === 6
          ? 'P&L fields present in database schema'
          : 'Missing P&L calculation fields'
      };
    } catch (err) {
      checks.pnlCalculation = {
        passed: false,
        reason: `P&L check error: ${err.message}`
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 9: NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const notifCheck = await pool.query(`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') as has_table
      `);

      checks.notifications = {
        passed: notifCheck.rows[0].has_table,
        reason: notifCheck.rows[0].has_table
          ? 'Notification system ready'
          : 'Notifications table not found'
      };
    } catch (err) {
      checks.notifications = {
        passed: false,
        reason: `Notification check error: ${err.message}`
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 10: STRATEGY DEPLOYMENT GATE
    // ─────────────────────────────────────────────────────────────────────────
    const backtestRes = await pool.query(
      `SELECT id, created_at, results
       FROM algo_backtest_runs
       WHERE user_id = $1 AND strategy_slug = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, 'kepwe-nifty-50-scalping']
    );
    const latestBacktest = backtestRes.rows[0];
    const metrics = latestBacktest?.results?.metrics || latestBacktest?.results || {};
    const strategyGate = validateNiftyScalpingDeploymentGate({
      outOfSampleWinRatePct: metrics.outOfSampleWinRatePct,
      riskReward: metrics.riskReward,
      profitFactor: metrics.profitFactor,
      expectancyAfterCosts: metrics.expectancyAfterCosts,
      drawdownApproved: metrics.drawdownApproved,
      tradeCount: metrics.tradeCount,
      walkForwardPassed: metrics.walkForwardPassed,
      stressedSlippagePassed: metrics.stressedSlippagePassed,
      topFiveOutlierTestPassed: metrics.topFiveOutlierTestPassed,
    });

    checks.strategyGate = {
      passed: strategyGate.isDeployable,
      checks: strategyGate.checks,
      reason: strategyGate.reason,
      source: latestBacktest ? { id: latestBacktest.id, createdAt: latestBacktest.created_at } : null,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    const allPassed = Object.values(checks).every(check => check.passed);

    await pool.query(
      `INSERT INTO quant_deployment_events (user_id, event_type, reason, gate_checks)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'DEPLOYMENT_VALIDATED', allPassed ? 'PASSED' : 'FAILED', JSON.stringify(checks)]
    );

    res.json({
      status: allPassed ? 'READY_TO_DEPLOY' : 'DEPLOYMENT_BLOCKED',
      allChecksPassed: allPassed,
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/live/status
 * Current live trading status
 */
router.get('/live/status', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;

    const statusRes = await pool.query(
      `SELECT status FROM algo_states WHERE user_id = $1`,
      [userId]
    );

    const brokerRes = await pool.query(
      `SELECT ba.broker, ba.status as broker_status, bot.token_expires_at
       FROM broker_accounts ba
       LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
       WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
       ORDER BY bot.created_at DESC LIMIT 1`,
      [userId]
    );

    const status = statusRes.rows[0]?.status || 'STOPPED';
    const brokerConnected = brokerRes.rows.length > 0 && brokerRes.rows[0].broker_status === 'CONNECTED';
    const brokerExpiry = brokerRes.rows[0]?.token_expires_at;

    res.json({
      strategyStatus: status,
      liveTrading: status === 'ACTIVE',
      broker: {
        name: 'Dhan',
        connected: brokerConnected,
        status: brokerRes.rows[0]?.broker_status || 'NOT_CONNECTED',
        tokenExpiresAt: brokerExpiry
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/live/enable
 * Enable live trading (only after all checks pass)
 */
router.post('/live/enable', requireAuth, requireFeature(FEATURES.LIVE_EXECUTION), async (req, res, next) => {
  try {
    const userId = req.userId;

    // First, validate all prerequisites
    const brokerRes = await pool.query(
      `SELECT ba.id, ba.status, ba.connection_mode, bot.access_token_ciphertext, bot.token_expires_at
       FROM broker_accounts ba
       LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
       WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
       ORDER BY bot.created_at DESC LIMIT 1`,
      [userId]
    );

    const broker = brokerRes.rows[0];
    if (!broker || broker.status !== 'CONNECTED' || broker.connection_mode !== 'LIVE' || !broker.access_token_ciphertext) {
      return res.status(409).json({
        error: 'Dhan broker not connected',
        action: 'Connect your Dhan account before enabling live trading'
      });
    }

    const validation = await pool.query(
      `SELECT gate_checks
       FROM quant_deployment_events
      WHERE user_id = $1 AND event_type = 'DEPLOYMENT_VALIDATED'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const gateChecks = validation.rows[0]?.gate_checks;
    const allGatesPassed = gateChecks
      && Object.keys(gateChecks).length > 0
      && Object.values(gateChecks).every((check) => check?.passed === true);
    if (!allGatesPassed) {
      return res.status(409).json({
        error: 'Live deployment gate has not passed',
        action: 'Run deployment validation and resolve every reported blocker before enabling live trading',
      });
    }

    // Update strategy status
    await pool.query(
      `UPDATE algo_states SET status = $1, updated_at = NOW() WHERE user_id = $2`,
      ['ACTIVE', userId]
    );

    // Log the event
    await pool.query(
      `INSERT INTO quant_deployment_events (user_id, event_type, reason)
       VALUES ($1, $2, $3)`,
      [userId, 'LIVE_DEPLOYED', 'Live trading enabled by user']
    );

    res.json({
      message: 'Live trading enabled',
      status: 'ACTIVE',
      strategy: 'KEPWE NIFTY 50 Scalping',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/live/disable
 * Disable live trading (graceful stop)
 */
router.post('/live/disable', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;

    await pool.query(
      `UPDATE algo_states SET status = $1, updated_at = NOW() WHERE user_id = $2`,
      ['STOPPED', userId]
    );

    await pool.query(
      `INSERT INTO quant_deployment_events (user_id, event_type, reason)
       VALUES ($1, $2, $3)`,
      [userId, 'LIVE_TRADING_DISABLED', 'Live trading disabled by user']
    );

    res.json({
      message: 'Live trading disabled',
      status: 'STOPPED',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/live/emergency-stop
 * Force-close all positions and stop trading immediately
 */
router.post('/live/emergency-stop', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;

    const brokerRes = await pool.query(
      `SELECT ba.id, ba.client_id, ba.status, ba.connection_mode, bot.access_token_ciphertext, bot.token_expires_at
       FROM broker_accounts ba
       JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
       WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
       ORDER BY bot.created_at DESC LIMIT 1`,
      [userId],
    );
    const broker = brokerRes.rows[0];
    if (!broker || broker.status !== 'CONNECTED' || broker.connection_mode !== 'LIVE') {
      return res.status(409).json({ error: 'Emergency stop blocked: no verified LIVE Dhan session is available.' });
    }
    const adapter = getBrokerAdapter('DHAN', 'LIVE', {
      dhanClientId: broker.client_id,
      accessToken: decryptBrokerSecret(broker.access_token_ciphertext),
      tokenExpiresAt: broker.token_expires_at,
    });
    const brokerExit = await adapter.exitAllPositions();

    // Keep positions pending until the broker confirms they are closed.
    const positionsRes = await pool.query(
      `SELECT id, symbol, quantity, entry_price FROM algo_positions
       WHERE user_id = $1 AND status = 'OPEN'`,
      [userId]
    );

    for (const position of positionsRes.rows) {
      await pool.query(
        `UPDATE algo_positions SET status = $1, updated_at = NOW() WHERE id = $2`,
        ['EMERGENCY_PENDING', position.id]
      );
    }

    // Stop strategy
    await pool.query(
      `UPDATE algo_states SET status = $1, updated_at = NOW() WHERE user_id = $2`,
      ['STOPPED', userId]
    );

    // Log emergency
    await pool.query(
      `INSERT INTO quant_deployment_events (user_id, event_type, reason)
       VALUES ($1, $2, $3)`,
      [userId, 'EMERGENCY_STOP', `Emergency stop requested through Dhan - ${positionsRes.rows.length} position(s) pending broker confirmation`]
    );
    await tryCreateQuantNotification(pool, {
      userId,
      type: 'LIVE_TRADING_STOPPED',
      title: 'Emergency stop requested',
      body: 'Dhan accepted the exit-all-positions request; positions remain pending until reconciliation confirms closure.',
      data: { positions: positionsRes.rows.length, brokerResponse: brokerExit },
    });

    res.json({
      message: 'Emergency stop requested from Dhan',
      positionsPendingConfirmation: positionsRes.rows.length,
      status: 'STOPPED',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;
