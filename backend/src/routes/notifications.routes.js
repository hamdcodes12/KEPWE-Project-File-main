import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function serializeNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

/**
 * GET /api/notifications
 * Returns the authenticated user's own notifications, most recent first.
 */
router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );

    res.json({ notifications: result.rows.map(serializeNotification) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read. Ownership is enforced by requiring
 * user_id = req.userId in the WHERE clause — a user can never mark another
 * user's notification as read.
 */
router.patch('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id, is_read`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ id: result.rows[0].id, isRead: result.rows[0].is_read });
  } catch (err) {
    next(err);
  }
});

export default router;
