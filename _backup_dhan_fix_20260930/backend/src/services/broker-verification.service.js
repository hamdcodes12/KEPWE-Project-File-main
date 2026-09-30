import { createHash } from 'crypto';
import { pool } from '../config/db.js';
import { getBrokerAdapter } from '../algo/broker-adapters.js';
import { decryptBrokerSecret } from './broker-token.service.js';

/**
 * Comprehensive broker verification pipeline
 * Ensures "CONNECTED" means fully working with all required functionality
 */

const VERIFICATION_CHECKS = {
  AUTHENTICATION: 'AUTHENTICATION',
  PROFILE: 'PROFILE', 
  FUNDS: 'FUNDS',
  HOLDINGS: 'HOLDINGS',
  POSITIONS: 'POSITIONS',
  ORDERS: 'ORDERS',
  TRADES: 'TRADES',
  MARKET_DATA: 'MARKET_DATA',
  SESSION_VALIDITY: 'SESSION_VALIDITY',
  PERMISSIONS: 'PERMISSIONS',
};

const VERIFICATION_STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PARTIAL: 'PARTIAL',
  ERROR: 'ERROR',
};

const CONNECTION_STATUS = {
  CONNECTED: 'CONNECTED',
  PARTIALLY_CONNECTED: 'PARTIALLY_CONNECTED',
  FAILED: 'FAILED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  DISCONNECTED: 'DISCONNECTED',
};

/**
 * Perform comprehensive verification of a broker connection
 * @param {string} userId - KEPWE user ID
 * @param {string} broker - Broker name (DHAN, ANGEL_ONE)
 * @param {Object} options - Verification options
 * @returns {Object} Verification result with detailed checks
 */
export async function verifyBrokerConnection(userId, broker, options = {}) {
  const {
    skipMarketData = false,
    timeout = 30000,
    logResults = true,
  } = options;

  const verificationId = createHash('sha256')
    .update(`${userId}-${broker}-${Date.now()}`)
    .digest('hex')
    .substring(0, 16);

  const result = {
    verificationId,
    userId,
    broker,
    timestamp: new Date().toISOString(),
    status: CONNECTION_STATUS.FAILED,
    overallScore: 0,
    checks: {},
    errors: [],
    warnings: [],
    accountData: null,
    lastSyncedAt: null,
  };

  let adapter = null;
  let passedChecks = 0;
  const totalChecks = skipMarketData ? 9 : 10;

  try {
    // Get broker adapter with user's credentials
    adapter = await getBrokerAdapterForUser(userId, broker);
    if (!adapter) {
      result.errors.push('No valid broker connection found for user');
      result.status = CONNECTION_STATUS.DISCONNECTED;
      return result;
    }

    // 1. Authentication/Session Validity Check
    result.checks[VERIFICATION_CHECKS.AUTHENTICATION] = await verifyAuthentication(adapter);
    if (result.checks[VERIFICATION_CHECKS.AUTHENTICATION].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // 2. Profile/Account Check
    result.checks[VERIFICATION_CHECKS.PROFILE] = await verifyProfile(adapter, adapter.expectedClientId);
    if (result.checks[VERIFICATION_CHECKS.PROFILE].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
      result.accountData = result.checks[VERIFICATION_CHECKS.PROFILE].data;
    }

    // 3. Funds/Margin Check
    result.checks[VERIFICATION_CHECKS.FUNDS] = await verifyFunds(adapter);
    if (result.checks[VERIFICATION_CHECKS.FUNDS].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // 4. Holdings Check
    result.checks[VERIFICATION_CHECKS.HOLDINGS] = await verifyHoldings(adapter);
    if (result.checks[VERIFICATION_CHECKS.HOLDINGS].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // 5. Positions Check
    result.checks[VERIFICATION_CHECKS.POSITIONS] = await verifyPositions(adapter);
    if (result.checks[VERIFICATION_CHECKS.POSITIONS].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // 6. Orders Check
    result.checks[VERIFICATION_CHECKS.ORDERS] = await verifyOrders(adapter);
    if (result.checks[VERIFICATION_CHECKS.ORDERS].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // 7. Trades Check
    result.checks[VERIFICATION_CHECKS.TRADES] = await verifyTrades(adapter);
    if (result.checks[VERIFICATION_CHECKS.TRADES].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // 8. Market Data Check (optional)
    if (!skipMarketData) {
      result.checks[VERIFICATION_CHECKS.MARKET_DATA] = await verifyMarketData(adapter, broker);
      if (result.checks[VERIFICATION_CHECKS.MARKET_DATA].status === VERIFICATION_STATUS.PASS) {
        passedChecks++;
      }
    }

    // 9. Session Validity Check
    result.checks[VERIFICATION_CHECKS.SESSION_VALIDITY] = await verifySessionValidity(adapter);
    if (result.checks[VERIFICATION_CHECKS.SESSION_VALIDITY].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // 10. Permissions Check
    result.checks[VERIFICATION_CHECKS.PERMISSIONS] = await verifyPermissions(adapter, broker, result.checks);
    if (result.checks[VERIFICATION_CHECKS.PERMISSIONS].status === VERIFICATION_STATUS.PASS) {
      passedChecks++;
    }

    // Calculate overall status
    result.overallScore = Math.round((passedChecks / totalChecks) * 100);
    
    if (passedChecks === totalChecks) {
      result.status = CONNECTION_STATUS.CONNECTED;
    } else if (passedChecks >= Math.ceil(totalChecks * 0.7)) {
      result.status = CONNECTION_STATUS.PARTIALLY_CONNECTED;
      result.warnings.push('Some broker functionality is limited');
    } else if (result.checks[VERIFICATION_CHECKS.AUTHENTICATION]?.status === VERIFICATION_STATUS.FAIL) {
      result.status = CONNECTION_STATUS.SESSION_EXPIRED;
    } else {
      result.status = CONNECTION_STATUS.FAILED;
    }

    result.lastSyncedAt = new Date().toISOString();

  } catch (error) {
    result.errors.push(`Verification failed: ${error.message}`);
    result.status = CONNECTION_STATUS.FAILED;
  }

  // Log results for monitoring
  if (logResults) {
    console.log(`[BROKER_VERIFICATION] ${JSON.stringify({
      verificationId: result.verificationId,
      userId,
      broker,
      status: result.status,
      score: result.overallScore,
      passed: passedChecks,
      total: totalChecks,
      timestamp: result.timestamp,
    })}`);
  }

  // Store verification result
  await storeVerificationResult(result);

  return result;
}

/**
 * Get broker adapter configured for a specific user
 */
async function getBrokerAdapterForUser(userId, broker) {
  try {
    const result = await pool.query(
      `SELECT a.id, a.client_id, a.status, a.connection_mode,
              t.access_token_ciphertext, t.refresh_token_ciphertext, t.feed_token_ciphertext,
              t.token_expires_at
       FROM broker_accounts a
       LEFT JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1 AND a.broker = $2 AND a.status IN ('CONNECTED', 'PARTIALLY_CONNECTED')`,
      [userId, broker]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    if (broker === 'DHAN') {
      const adapter = getBrokerAdapter('DHAN', 'LIVE', {
        dhanClientId: row.client_id,
        accessToken: decryptBrokerSecret(row.access_token_ciphertext),
        tokenExpiresAt: row.token_expires_at,
      });
      adapter.expectedClientId = row.client_id;
      return adapter;
    }
    
    if (broker === 'ANGEL_ONE') {
      // For Angel One, we need to create adapter with stored session tokens
      const { AngelOneAdapter } = await import('../algo/broker-adapters.js');
      const adapter = new AngelOneAdapter({
        angelOneClientCode: row.client_id,
        jwtToken: decryptBrokerSecret(row.access_token_ciphertext),
        refreshToken: row.refresh_token_ciphertext ? decryptBrokerSecret(row.refresh_token_ciphertext) : null,
        feedToken: row.feed_token_ciphertext ? decryptBrokerSecret(row.feed_token_ciphertext) : null,
        tokenExpiresAt: row.token_expires_at,
        // Include environment-based config for API key and TOTP secret
        apiKey: process.env.ANGEL_ONE_API_KEY,
        totpSecret: process.env.ANGEL_ONE_TOTP_SECRET,
      });
      adapter.expectedClientId = row.client_id;
      return adapter;
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to get broker adapter: ${error.message}`);
  }
}

/**
 * Individual verification checks
 */

async function verifyAuthentication(adapter) {
  const check = {
    name: 'Authentication',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    const authResult = await adapter.authenticate();
    if (authResult.authenticated) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = 'Authentication successful';
      check.data = { authenticated: true, broker: authResult.broker };
    } else {
      check.message = 'Authentication failed';
    }
  } catch (error) {
    check.message = `Authentication error: ${error.message}`;
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      check.status = VERIFICATION_STATUS.ERROR;
    }
  }

  return check;
}

export async function assertBrokerIdentity(adapter, broker, expectedClientId) {
  const profile = await adapter.getProfile();
  const actualClientId = broker === 'DHAN'
    ? profile?.clientId || profile?.client_id
    : profile?.clientCode || profile?.clientcode || profile?.clientId;
  if (!actualClientId || String(actualClientId) !== String(expectedClientId)) {
    const error = new Error(`${broker} profile identity does not match the connected account`);
    error.statusCode = 409;
    error.code = 'BROKER_ACCOUNT_IDENTITY_MISMATCH';
    throw error;
  }
  return profile;
}

async function verifyProfile(adapter, expectedClientId) {
  const check = {
    name: 'Profile/Account',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    const profile = await adapter.getProfile();
    const actualClientId = profile?.clientId || profile?.client_id || profile?.clientCode || profile?.clientcode;
    if (expectedClientId && (!actualClientId || String(actualClientId) !== String(expectedClientId))) {
      check.message = 'Broker profile identity does not match the stored account';
      return check;
    }
    if (profile && (profile.clientcode || profile.clientId || profile.name)) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = 'Profile data retrieved';
      check.data = profile;
    } else {
      check.message = 'Profile data unavailable';
    }
  } catch (error) {
    check.message = `Profile error: ${error.message}`;
  }

  return check;
}

async function verifyFunds(adapter) {
  const check = {
    name: 'Funds/Margin',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    const funds = await adapter.getMargin();
    if (funds && (funds.availablecash !== undefined || funds.available !== undefined || funds.net !== undefined)) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = 'Funds data retrieved';
      check.data = funds;
    } else {
      check.message = 'Funds data unavailable';
    }
  } catch (error) {
    check.message = `Funds error: ${error.message}`;
  }

  return check;
}

async function verifyHoldings(adapter) {
  const check = {
    name: 'Holdings',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    const holdings = await adapter.getHoldings();
    if (Array.isArray(holdings)) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = `Holdings retrieved (${holdings.length} items)`;
      check.data = { count: holdings.length, hasHoldings: holdings.length > 0 };
    } else {
      check.message = 'Holdings data format invalid';
    }
  } catch (error) {
    check.message = `Holdings error: ${error.message}`;
  }

  return check;
}

async function verifyPositions(adapter) {
  const check = {
    name: 'Positions',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    const positions = await adapter.getPositions();
    if (Array.isArray(positions)) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = `Positions retrieved (${positions.length} items)`;
      check.data = { count: positions.length, hasPositions: positions.length > 0 };
    } else {
      check.message = 'Positions data format invalid';
    }
  } catch (error) {
    check.message = `Positions error: ${error.message}`;
  }

  return check;
}

async function verifyOrders(adapter) {
  const check = {
    name: 'Orders',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    const orders = await adapter.getOrderBook();
    if (Array.isArray(orders)) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = `Orders retrieved (${orders.length} items)`;
      check.data = { count: orders.length, hasOrders: orders.length > 0 };
    } else {
      check.message = 'Orders data format invalid';
    }
  } catch (error) {
    check.message = `Orders error: ${error.message}`;
  }

  return check;
}

async function verifyTrades(adapter) {
  const check = {
    name: 'Trades',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    const trades = await adapter.getTradeBook();
    if (Array.isArray(trades)) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = `Trades retrieved (${trades.length} items)`;
      check.data = { count: trades.length, hasTrades: trades.length > 0 };
    } else {
      check.message = 'Trades data format invalid';
    }
  } catch (error) {
    check.message = `Trades error: ${error.message}`;
  }

  return check;
}

async function verifyMarketData(adapter, broker) {
  const check = {
    name: 'Market Data',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    // Test with commonly available symbols
    const testSymbols = {
      DHAN: { exchange: 'IDX_I', symbol: 'NIFTY 50', symbolToken: '13' },
      ANGEL_ONE: { exchange: 'NSE', symbol: 'NIFTY', symbolToken: '99926000' },
    };

    const testSymbol = testSymbols[broker];
    if (!testSymbol) {
      check.message = 'Market data test not configured for this broker';
      check.status = VERIFICATION_STATUS.PARTIAL;
      return check;
    }

    const marketData = await adapter.getMarketData({
      exchange: testSymbol.exchange,
      symbolToken: testSymbol.symbolToken,
    });

    const data = marketData?.data || marketData;
    const quote = data?.[testSymbol.exchange]?.[String(testSymbol.symbolToken)] || data?.IDX_I?.[String(testSymbol.symbolToken)];
    const hasMarketData = Number(quote?.last_price ?? quote?.ltp) > 0;
    if (hasMarketData) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = 'Market data retrieved';
      check.data = { symbol: testSymbol.symbol, securityId: testSymbol.symbolToken, ltp: Number(quote.last_price ?? quote.ltp) };
    } else {
      check.message = 'Market data unavailable';
    }
  } catch (error) {
    check.message = `Market data error: ${error.message}`;
    check.status = VERIFICATION_STATUS.FAIL;
  }

  return check;
}

async function verifySessionValidity(adapter) {
  const check = {
    name: 'Session Validity',
    status: VERIFICATION_STATUS.FAIL,
    message: '',
    data: null,
    executedAt: new Date().toISOString(),
  };

  try {
    // Test session by making a lightweight API call
    const profile = await adapter.getProfile();
    if (profile) {
      check.status = VERIFICATION_STATUS.PASS;
      check.message = 'Session is valid';
      check.data = { valid: true };
    } else {
      check.message = 'Session appears invalid';
    }
  } catch (error) {
    check.message = `Session validity error: ${error.message}`;
    if (error.message.includes('expired') || error.message.includes('unauthorized')) {
      check.status = VERIFICATION_STATUS.ERROR;
    }
  }

  return check;
}

async function verifyPermissions(adapter, broker, checks) {
  const requiredChecks = [
    VERIFICATION_CHECKS.AUTHENTICATION,
    VERIFICATION_CHECKS.PROFILE,
    VERIFICATION_CHECKS.FUNDS,
    VERIFICATION_CHECKS.HOLDINGS,
    VERIFICATION_CHECKS.POSITIONS,
    VERIFICATION_CHECKS.ORDERS,
    VERIFICATION_CHECKS.TRADES,
    VERIFICATION_CHECKS.MARKET_DATA,
  ];
  const failedChecks = requiredChecks.filter((name) => checks[name]?.status !== VERIFICATION_STATUS.PASS);
  const check = {
    name: 'Permissions',
    status: failedChecks.length === 0 ? VERIFICATION_STATUS.PASS : VERIFICATION_STATUS.PARTIAL,
    message: failedChecks.length === 0
      ? 'Required permissions confirmed by successful API responses'
      : `Permissions not confirmed for: ${failedChecks.join(', ')}`,
    data: null,
    executedAt: new Date().toISOString(),
  };

  check.data = Object.fromEntries(requiredChecks.map((name) => [name, checks[name]?.status || VERIFICATION_STATUS.FAIL]));

  return check;
}

/**
 * Store verification result for monitoring and debugging
 */
async function storeVerificationResult(result) {
  try {
    const startTime = Date.now();
    
    // Store in activity logs (existing behavior)
    await pool.query(
      `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata, created_at)
       VALUES ($1, 'BROKER_VERIFICATION', $2, $3::jsonb, NOW())`,
      [
        result.userId,
        `Broker verification: ${result.broker} - ${result.status}`,
        JSON.stringify({
          verificationId: result.verificationId,
          broker: result.broker,
          status: result.status,
          score: result.overallScore,
          checks: Object.keys(result.checks).reduce((acc, key) => {
            acc[key] = {
              status: result.checks[key].status,
              message: result.checks[key].message,
            };
            return acc;
          }, {}),
          errors: result.errors,
          warnings: result.warnings,
          lastSyncedAt: result.lastSyncedAt,
        }),
      ]
    );

    // Get broker_account_id
    const accountResult = await pool.query(
      `SELECT id FROM broker_accounts WHERE user_id = $1 AND broker = $2`,
      [result.userId, result.broker]
    );

    if (accountResult.rows.length > 0) {
      const brokerAccountId = accountResult.rows[0].id;
      const verificationDuration = Date.now() - startTime;

      // Count passed checks
      const checksPassed = Object.values(result.checks).filter(
        check => check.status === VERIFICATION_STATUS.PASS
      ).length;
      const checksTotal = Object.keys(result.checks).length;

      // Store detailed verification history
      await pool.query(
        `INSERT INTO broker_verification_history 
         (user_id, broker_account_id, broker, verification_id, status, overall_score, 
          checks_passed, checks_total, checks_detail, errors, warnings, verification_duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)`,
        [
          result.userId,
          brokerAccountId,
          result.broker,
          result.verificationId,
          result.status,
          result.overallScore,
          checksPassed,
          checksTotal,
          JSON.stringify(result.checks),
          result.errors,
          result.warnings,
          verificationDuration,
        ]
      );
    }
  } catch (error) {
    console.error('[BROKER_VERIFICATION] Failed to store result:', error.message);
  }
}

/**
 * Get latest verification result for a user's broker
 */
export async function getLatestVerification(userId, broker) {
  try {
    const result = await pool.query(
      `SELECT metadata, created_at
       FROM algo_activity_logs
       WHERE user_id = $1 AND event_type = 'BROKER_VERIFICATION'
         AND message LIKE $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, `Broker verification: ${broker} -%`]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      ...result.rows[0].metadata,
      timestamp: result.rows[0].created_at,
    };
  } catch (error) {
    console.error('[BROKER_VERIFICATION] Failed to get latest verification:', error.message);
    return null;
  }
}

export { VERIFICATION_CHECKS, VERIFICATION_STATUS, CONNECTION_STATUS };