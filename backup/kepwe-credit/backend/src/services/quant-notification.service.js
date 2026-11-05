const NOTIFICATION_TYPES = new Set([
  'STRATEGY_SIGNAL',
  'ORDER_SUBMITTED',
  'PARTIAL_FILL',
  'ORDER_FILLED',
  'ORDER_REJECTED',
  'STOP_LOSS',
  'TARGET',
  'POSITION_CLOSED',
  'SESSION_EXPIRED',
  'RISK_REJECTION',
  'LIVE_TRADING_STOPPED',
  'ORDER_CANCELLED',
  'BROKER_CONNECTED',
  'MARKET_DATA_UNAVAILABLE',
  'DEPLOYMENT_BLOCKED',
  'STRATEGY_ACTIVATED',
  'EMERGENCY_STOP',
  'RECONCILIATION_MISMATCH',
]);

/** Creates at most one notification of `type` per user within `windowHours`. */
export async function tryCreateQuantNotificationOnce(pool, notification, windowHours = 6) {
  try {
    const recent = await pool.query(
      `SELECT 1 FROM notifications WHERE user_id = $1 AND type = $2 AND created_at >= NOW() - ($3::int * INTERVAL '1 hour') LIMIT 1`,
      [notification.userId, notification.type, windowHours],
    );
    if (recent.rows.length > 0) return false;
  } catch (_) {
    return false;
  }
  return tryCreateQuantNotification(pool, notification);
}

export async function createQuantNotification(pool, {
  userId,
  type,
  title,
  body,
  data = {},
}) {
  if (!userId || !NOTIFICATION_TYPES.has(type)) return;
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, type, title, body || null, JSON.stringify(data)],
  );
}

export async function tryCreateQuantNotification(pool, notification) {
  try {
    await createQuantNotification(pool, notification);
    return true;
  } catch (error) {
    console.error(`[QUANT_NOTIFICATION] ${notification.type || 'UNKNOWN'} delivery failed: ${error.message}`);
    return false;
  }
}
