import { pool } from '../config/db.js';

const DEFAULT_INTERVAL_MS = 60_000;

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

// LIVE-only runner: no paper market cycle
// Paper trading has been completely removed
export async function runPaperMarketCycle() {
  throw new Error('Paper trading is not supported. KEPWE Quant is LIVE-only.');
}

let runnerTimer = null;
let initialRunnerTimer = null;

export function startAlgoRunner(intervalMs = Number(process.env.ALGO_RUNNER_INTERVAL_MS || DEFAULT_INTERVAL_MS)) {
  if (runnerTimer) return runnerTimer;
  
  // No-op for LIVE-only mode - all order management done via DhanAdapter
  const effectiveInterval = Math.max(10_000, intervalMs);
  runnerTimer = setInterval(() => {}, effectiveInterval);
  runnerTimer.unref?.();
  
  return runnerTimer;
}

export function stopAlgoRunner() {
  if (runnerTimer) clearInterval(runnerTimer);
  if (initialRunnerTimer) clearTimeout(initialRunnerTimer);
  runnerTimer = null;
  initialRunnerTimer = null;
}
