/**
 * Writes a deliberately small, non-sensitive audit record for an admin
 * mutation. Never pass credentials, tokens, or request bodies to metadata.
 */
export async function logAdminAudit(client, { adminId, action, entityType, entityId = null, metadata = {}, req }) {
  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || null;
  const userAgent = req?.headers?.['user-agent'] || null;
  await client.query(
    `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [adminId, action, entityType, entityId, JSON.stringify(metadata), ip, userAgent]
  );
}
