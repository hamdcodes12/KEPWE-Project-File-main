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
]);

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
