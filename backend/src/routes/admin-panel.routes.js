import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAdminAuth, requireSuperAdmin } from '../middleware/admin.auth.js';
import {
  adminLogin,
  adminRefresh,
  adminLogout,
  getAdminProfile,
} from '../services/admin.auth.service.js';
import { logServerError } from '../lib/safe-logger.js';
import { logAdminAudit } from '../services/admin.audit.service.js';
import { mockAdminDb, getMockAdminDashboard, getMockRevenueAnalytics } from '../services/admin.mock.service.js';

const router = Router();

const getReqInfo = (req) => ({
  userAgent: req.headers['user-agent'],
  ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
});

const parsePagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize, 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

const paginationPayload = (page, pageSize, total) => ({
  page,
  pageSize,
  total: Number(total),
  totalPages: Math.ceil(Number(total) / pageSize),
});

const parseDateRange = (query) => {
  const range = ['today', '7d', '30d', 'custom'].includes(query.range) ? query.range : '30d';
  if (range === 'custom') {
    const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : null;
    const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : null;
    return { range, from: from || '1970-01-01', to: to || '2999-12-31' };
  }
  const interval = range === 'today' ? '1 day' : range === '7d' ? '7 days' : '30 days';
  return { range, interval };
};

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const sendCsv = (res, filename, columns, rows) => {
  const csv = [columns, ...rows.map((row) => columns.map((column) => csvValue(row[column])))]
    .map((row) => row.join(','))
    .join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
};

// ── Admin Auth ──────────────────────────────────────────────────────────────
router.post('/admin/auth/login', async (req, res, next) => {
  try {
    const schema = z.object({
      username: z.string().trim().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const result = await adminLogin(parsed.data, getReqInfo(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logServerError('admin.auth.login.failed', err, req);
    next(err);
  }
});

router.post('/admin/auth/refresh', async (req, res, next) => {
  try {
    const schema = z.object({ refreshToken: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    const result = await adminRefresh(parsed.data.refreshToken, getReqInfo(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/admin/auth/logout', async (req, res, next) => {
  try {
    const schema = z.object({ refreshToken: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    await adminLogout(parsed.data.refreshToken);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/auth/me', requireAdminAuth, async (req, res, next) => {
  try {
    const admin = await getAdminProfile(req.adminId);
    return res.json({ admin });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ── Admin Dashboard Analytics ───────────────────────────────────────────────
router.get('/admin/dashboard', requireAdminAuth, async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    if (!process.env.DATABASE_URL) {
      return res.json(getMockAdminDashboard(range.range));
    }
    const rangeStart = range.range === 'custom' ? range.from : range.range === 'today' ? 'today' : range.range === '7d' ? '7 days' : '30 days';
    const rangePredicate = range.range === 'custom'
      ? 'created_at >= $1::date AND created_at < ($2::date + INTERVAL \'1 day\')'
      : range.range === 'today' ? 'created_at >= CURRENT_DATE' : `created_at >= NOW() - INTERVAL '${rangeStart}'`;
    // Total users
    const totalUsers = await pool.query('SELECT COUNT(*) AS count FROM users');
    // New accounts (last 7 days)
    const newAccounts = await pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE ${rangePredicate}`,
      range.range === 'custom' ? [range.from, range.to] : []
    );
    // Active users (sessions in last 24h)
    const activeUsers = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS count FROM user_sessions
       WHERE created_at >= NOW() - INTERVAL '24 hours' AND revoked_at IS NULL`
    );
    // Total subscriptions
    const totalSubs = await pool.query('SELECT COUNT(*) AS count FROM subscriptions');
    // Active subscriptions
    const activeSubs = await pool.query(
      `SELECT COUNT(*) AS count FROM subscriptions WHERE status = 'active'`
    );
    // Revenue (sum of billing_history)
    const revenue = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM billing_history WHERE status = 'Paid' AND billing_date >= ${range.range === 'custom' ? '$1::date' : range.range === 'today' ? 'CURRENT_DATE' : `CURRENT_DATE - INTERVAL '${rangeStart}'`} ${range.range === 'custom' ? "AND billing_date < ($2::date + INTERVAL '1 day')" : ''}`,
      range.range === 'custom' ? [range.from, range.to] : []
    );

    // Recent registrations
    const recentRegistrations = await pool.query(
      `SELECT id, full_name, email, plan, role, is_active, created_at
       FROM users ORDER BY created_at DESC LIMIT 10`
    );

    // Recent activity (sessions + billing)
    const recentActivity = await pool.query(
      `SELECT 'login' AS type, u.full_name, u.email, us.created_at AS occurred_at
       FROM user_sessions us JOIN users u ON u.id = us.user_id
       WHERE us.revoked_at IS NULL
       UNION ALL
       SELECT 'purchase' AS type, u.full_name, u.email, bh.created_at AS occurred_at
       FROM billing_history bh JOIN users u ON u.id = bh.user_id
       ORDER BY occurred_at DESC LIMIT 15`
    );

    // Plans / subscriptions breakdown
    const planBreakdown = await pool.query(
      `SELECT p.name AS plan, p.display_name, COUNT(s.id) AS count
       FROM plans p
       LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'active'
       GROUP BY p.id, p.name, p.display_name
       ORDER BY count DESC`
    );

    // Payment / subscription details (recent)
    const recentPayments = await pool.query(
      `SELECT bh.id, bh.amount, bh.status, bh.plan_name, bh.invoice_number, bh.billing_date,
              u.full_name, u.email
       FROM billing_history bh
       JOIN users u ON u.id = bh.user_id
       ORDER BY bh.billing_date DESC LIMIT 10`
    );

    // User activity / login history
    const loginHistory = await pool.query(
      `SELECT us.id, u.full_name, u.email, us.user_agent, us.ip_address, us.created_at, us.remember_me
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       ORDER BY us.created_at DESC LIMIT 15`
    );

    res.json({
      stats: {
        totalUsers: Number(totalUsers.rows[0]?.count || 0),
        newAccounts: Number(newAccounts.rows[0]?.count || 0),
        activeUsers: Number(activeUsers.rows[0]?.count || 0),
        totalSubscriptions: Number(totalSubs.rows[0]?.count || 0),
        activeSubscriptions: Number(activeSubs.rows[0]?.count || 0),
        revenue: Number(revenue.rows[0]?.total || 0),
        range: range.range,
      },
      recentRegistrations: recentRegistrations.rows,
      recentActivity: recentActivity.rows,
      planBreakdown: planBreakdown.rows,
      recentPayments: recentPayments.rows,
      loginHistory: loginHistory.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ── Admin Users Management ──────────────────────────────────────────────────
router.get('/admin/users', requireAdminAuth, async (req, res, next) => {
  try {
    const { search = '', status = '', role = '', plan = '', company = '', risk = '' } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query);

    if (!process.env.DATABASE_URL) {
      let filtered = [...mockAdminDb.users];
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
      }
      return res.json({
        users: filtered,
        pagination: paginationPayload(page, pageSize, filtered.length),
      });
    }
    const params = [];
    let where = 'WHERE 1=1';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    if (status === 'active') {
      where += ` AND u.is_active = TRUE`;
    } else if (status === 'inactive') {
      where += ` AND u.is_active = FALSE`;
    }
    if (role) {
      params.push(role);
      where += ` AND u.role = $${params.length}`;
    }
    if (plan) {
      params.push(plan);
      where += ` AND u.plan::text = $${params.length}`;
    }
    if (company) {
      params.push(`%${company}%`);
      where += ` AND EXISTS (SELECT 1 FROM company_members cm JOIN companies c ON c.id = cm.company_id WHERE cm.user_id = u.id AND c.name ILIKE $${params.length})`;
    }
    if (risk) {
      params.push(risk);
      where += ` AND EXISTS (SELECT 1 FROM risk_profiles rp WHERE rp.user_id = u.id AND rp.risk_category::text = $${params.length})`;
    }
    if (req.query.signupFrom && /^\d{4}-\d{2}-\d{2}$/.test(req.query.signupFrom)) {
      params.push(req.query.signupFrom);
      where += ` AND u.created_at >= $${params.length}::date`;
    }
    if (req.query.signupTo && /^\d{4}-\d{2}-\d{2}$/.test(req.query.signupTo)) {
      params.push(req.query.signupTo);
      where += ` AND u.created_at < ($${params.length}::date + INTERVAL '1 day')`;
    }
    if (req.query.lastLoginFrom && /^\d{4}-\d{2}-\d{2}$/.test(req.query.lastLoginFrom)) {
      params.push(req.query.lastLoginFrom);
      where += ` AND EXISTS (SELECT 1 FROM user_sessions ls WHERE ls.user_id = u.id AND ls.created_at >= $${params.length}::date)`;
    }
    if (req.query.lastLoginTo && /^\d{4}-\d{2}-\d{2}$/.test(req.query.lastLoginTo)) {
      params.push(req.query.lastLoginTo);
      where += ` AND EXISTS (SELECT 1 FROM user_sessions ls WHERE ls.user_id = u.id AND ls.created_at < ($${params.length}::date + INTERVAL '1 day'))`;
    }

    const result = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.mobile, u.role, u.plan, u.is_active, u.created_at,
              (SELECT c.name FROM company_members cm JOIN companies c ON c.id = cm.company_id WHERE cm.user_id = u.id ORDER BY cm.is_owner DESC LIMIT 1) AS company_name,
              (SELECT rp.risk_category FROM risk_profiles rp WHERE rp.user_id = u.id) AS risk_category,
              CASE WHEN EXISTS (SELECT 1 FROM billing_history bh WHERE bh.user_id = u.id AND bh.status = 'Failed') THEN 'payment_failed'
             WHEN EXISTS (SELECT 1 FROM subscriptions s2 WHERE s2.user_id = u.id AND s2.renews_on IS NOT NULL AND s2.renews_on <= CURRENT_DATE + 7 AND s2.status = 'active') THEN 'expiring'
             WHEN NOT EXISTS (SELECT 1 FROM user_sessions us2 WHERE us2.user_id = u.id AND us2.created_at >= NOW() - INTERVAL '30 days') THEN 'inactive'
             ELSE 'healthy' END AS health_status,
              (SELECT MAX(us.created_at) FROM user_sessions us WHERE us.user_id = u.id) AS last_login,
              (SELECT COUNT(*) FROM user_sessions us WHERE us.user_id = u.id) AS session_count,
              (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id) AS subscription_count
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
    res.json({ users: result.rows, pagination: paginationPayload(page, pageSize, countResult.rows[0].total) });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userResult = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.role, u.plan, u.is_active, u.email_verified, u.created_at,
              (SELECT MAX(us.created_at) FROM user_sessions us WHERE us.user_id = u.id) AS last_login
       FROM users u WHERE u.id = $1`,
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Subscription details
    const subscription = await pool.query(
      `SELECT s.id, s.status, s.price_at_signup, s.renews_on, s.payment_method, s.auto_renew, s.created_at,
              p.name AS plan, p.display_name, p.price_inr
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1`,
      [id]
    );

    // Billing history
    const billing = await pool.query(
      `SELECT id, amount, status, plan_name, invoice_number, billing_date
       FROM billing_history WHERE user_id = $1 ORDER BY billing_date DESC LIMIT 20`,
      [id]
    );

    // Session / login history
    const sessions = await pool.query(
      `SELECT id, user_agent, ip_address, created_at, revoked_at, remember_me
       FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    // Risk profile
    const riskProfile = await pool.query(
      `SELECT experience, capital_range, capital_amount, max_acceptable_loss, indices, risk_category, onboarding_complete
       FROM risk_profiles WHERE user_id = $1`,
      [id]
    );

    // Trade journal
    const tradeJournal = await pool.query(
      `SELECT id, trade_date, index_symbol, strategy, verdict, is_override, status, pnl
       FROM trade_journals WHERE user_id = $1 ORDER BY trade_date DESC LIMIT 20`,
      [id]
    );

    // Onboarding / risk profile (users.onboarding_completed_at + risk_profiles)
    const onboarding = await pool.query(
      `SELECT u.id,
              u.onboarding_completed_at,
              rp.experience,
              rp.capital_range,
              rp.capital_amount,
              rp.max_acceptable_loss,
              rp.indices,
              rp.risk_category,
              rp.onboarding_complete
       FROM users u
       LEFT JOIN risk_profiles rp ON rp.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );

    // Business onboarding answers
    const businessOnboarding = await pool.query(
      `SELECT bo.id, bo.business_type, bo.business_age, bo.avg_monthly_turnover, bo.needs, bo.completed, bo.created_at,
              p.name AS recommended_plan, p.display_name AS recommended_plan_name
       FROM business_onboardings bo
       LEFT JOIN plans p ON p.id = bo.recommended_plan_id
       WHERE bo.user_id = $1
       ORDER BY bo.created_at DESC LIMIT 5`,
      [id]
    );

    // Support tickets
    const supportTickets = await pool.query(
      `SELECT id, subject, category, priority, status, created_at, updated_at
       FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    // Companies linked to user
    const userCompanies = await pool.query(
      `SELECT c.id, c.name, c.cin, c.gstin, c.pan, c.business_type, c.industry, c.state, c.city,
              c.address, c.avg_monthly_turnover, c.employee_count, c.incorporation_date, c.gst_status,
              c.created_at, c.updated_at, cm.role AS member_role, cm.is_owner
       FROM companies c
       JOIN company_members cm ON cm.company_id = c.id
       WHERE cm.user_id = $1
       ORDER BY c.created_at DESC LIMIT 10`,
      [id]
    );

    // Compliance checks
    const complianceChecks = await pool.query(
      `SELECT id, company_name, overall_score, gst_status, tds_status, mca_status, payroll_status, created_at
       FROM compliance_checks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    const privateNotes = await pool.query(
      `SELECT n.id, n.note, n.created_at, n.updated_at, a.display_name AS admin_name
       FROM admin_user_notes n LEFT JOIN admin_users a ON a.id = n.admin_id
       WHERE n.user_id = $1 ORDER BY n.updated_at DESC`, [id]
    );
    const internalTags = await pool.query(
      `SELECT id, tag, created_at FROM admin_user_tags WHERE user_id = $1 ORDER BY tag`, [id]
    );

    // Activity timeline (unified)
    const activityTimeline = await pool.query(
      `SELECT 'login' AS type, 'User logged in' AS description, us.created_at
       FROM user_sessions us WHERE us.user_id = $1
       UNION ALL
       SELECT 'purchase', 'Payment: ' || bh.plan_name || ' (₹' || bh.amount || ')', bh.created_at
       FROM billing_history bh WHERE bh.user_id = $1
       UNION ALL
       SELECT 'ticket', 'Support ticket: ' || st.subject, st.created_at
       FROM support_tickets st WHERE st.user_id = $1
       UNION ALL
       SELECT 'onboarding', 'Business onboarding completed', bo.created_at
       FROM business_onboardings bo WHERE bo.user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    res.json({
      user,
      subscription: subscription.rows[0] || null,
      billing: billing.rows,
      sessions: sessions.rows,
      riskProfile: riskProfile.rows[0] || null,
      tradeJournal: tradeJournal.rows,
      onboarding: onboarding.rows[0] || null,
      businessOnboarding: businessOnboarding.rows,
      supportTickets: supportTickets.rows,
      userCompanies: userCompanies.rows,
      complianceChecks: complianceChecks.rows,
      privateNotes: privateNotes.rows,
      internalTags: internalTags.rows,
      activityTimeline: activityTimeline.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/users/:id/status', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const beforeResult = await client.query('SELECT is_active FROM users WHERE id = $1 FOR UPDATE', [id]);
      const before = beforeResult.rows[0]?.is_active;
      const result = await client.query(
        `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, is_active`,
        [parsed.data.isActive, id]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      if (!parsed.data.isActive) {
        await client.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
      }
      await logAdminAudit(client, {
        adminId: req.adminId, action: parsed.data.isActive ? 'user.activated' : 'user.deactivated',
        entityType: 'user', entityId: id, metadata: { before: { isActive: before }, after: { isActive: parsed.data.isActive } }, req,
      });
      await client.query('COMMIT');
      res.json({ user: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ── Admin Website Management ────────────────────────────────────────────────
router.get('/admin/website-sections', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, key, label, route, is_enabled, display_title, display_subtitle, content, visibility, sort_order, updated_at
       FROM website_sections ORDER BY sort_order`
    );
    res.json({ sections: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/website-sections/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      isEnabled: z.boolean().optional(),
      displayTitle: z.string().max(255).nullable().optional(),
      displaySubtitle: z.string().max(500).nullable().optional(),
      content: z.string().nullable().optional(),
      visibility: z.enum(['public', 'authenticated', 'subscribers']).optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const fields = [];
    const params = [];
    if (parsed.data.isEnabled !== undefined) {
      params.push(parsed.data.isEnabled);
      fields.push(`is_enabled = $${params.length}`);
    }
    if (parsed.data.displayTitle !== undefined) {
      params.push(parsed.data.displayTitle);
      fields.push(`display_title = $${params.length}`);
    }
    if (parsed.data.displaySubtitle !== undefined) {
      params.push(parsed.data.displaySubtitle);
      fields.push(`display_subtitle = $${params.length}`);
    }
    if (parsed.data.content !== undefined) {
      params.push(parsed.data.content);
      fields.push(`content = $${params.length}`);
    }
    if (parsed.data.visibility !== undefined) {
      params.push(parsed.data.visibility);
      fields.push(`visibility = $${params.length}`);
    }
    if (parsed.data.sortOrder !== undefined) {
      params.push(parsed.data.sortOrder);
      fields.push(`sort_order = $${params.length}`);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    params.push(req.adminId);
    fields.push(`updated_by = $${params.length}`);
    params.push(id);
    fields.push(`updated_at = NOW()`);

    const result = await pool.query(
      `UPDATE website_sections SET ${fields.join(', ')} WHERE id = $${params.length}
       RETURNING id, key, label, route, is_enabled, display_title, display_subtitle, content, visibility, sort_order, updated_at`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }
    await logAdminAudit(pool, {
      adminId: req.adminId, action: 'website_section.updated', entityType: 'website_section', entityId: id,
      metadata: { fields: Object.keys(parsed.data) }, req,
    });
    res.json({ section: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Admin Announcements Management ──────────────────────────────────────────
router.get('/admin/announcements', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.message, a.button_text, a.button_link, a.is_active, a.placement,
              a.start_at, a.end_at, a.created_at, a.updated_at, au.display_name AS created_by_name
       FROM announcements a
       LEFT JOIN admin_users au ON au.id = a.created_by
       ORDER BY a.created_at DESC`
    );
    res.json({ announcements: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/announcements', requireAdminAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(1, 'Title is required').max(255),
      message: z.string().trim().min(1, 'Message is required'),
      buttonText: z.string().max(100).nullable().optional(),
      buttonLink: z.string().max(500).nullable().optional(),
      isActive: z.boolean().default(true),
      placement: z.enum(['popup', 'banner', 'toast']).default('popup'),
      startAt: z.string().nullable().optional(),
      endAt: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const d = parsed.data;
    const result = await pool.query(
      `INSERT INTO announcements (title, message, button_text, button_link, is_active, placement, start_at, end_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, message, button_text, button_link, is_active, placement, start_at, end_at, created_at`,
      [d.title, d.message, d.buttonText || null, d.buttonLink || null, d.isActive, d.placement,
       d.startAt ? new Date(d.startAt) : null, d.endAt ? new Date(d.endAt) : null, req.adminId]
    );
    await logAdminAudit(pool, {
      adminId: req.adminId, action: 'announcement.created', entityType: 'announcement', entityId: result.rows[0].id,
      metadata: { placement: d.placement, isActive: d.isActive }, req,
    });
    res.status(201).json({ announcement: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/announcements/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      title: z.string().trim().min(1).max(255).optional(),
      message: z.string().trim().min(1).optional(),
      buttonText: z.string().max(100).nullable().optional(),
      buttonLink: z.string().max(500).nullable().optional(),
      isActive: z.boolean().optional(),
      placement: z.enum(['popup', 'banner', 'toast']).optional(),
      startAt: z.string().nullable().optional(),
      endAt: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const fields = [];
    const params = [];
    const d = parsed.data;
    if (d.title !== undefined) { params.push(d.title); fields.push(`title = $${params.length}`); }
    if (d.message !== undefined) { params.push(d.message); fields.push(`message = $${params.length}`); }
    if (d.buttonText !== undefined) { params.push(d.buttonText); fields.push(`button_text = $${params.length}`); }
    if (d.buttonLink !== undefined) { params.push(d.buttonLink); fields.push(`button_link = $${params.length}`); }
    if (d.isActive !== undefined) { params.push(d.isActive); fields.push(`is_active = $${params.length}`); }
    if (d.placement !== undefined) { params.push(d.placement); fields.push(`placement = $${params.length}`); }
    if (d.startAt !== undefined) { params.push(d.startAt ? new Date(d.startAt) : null); fields.push(`start_at = $${params.length}`); }
    if (d.endAt !== undefined) { params.push(d.endAt ? new Date(d.endAt) : null); fields.push(`end_at = $${params.length}`); }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    params.push(id);
    fields.push(`updated_at = NOW()`);

    const result = await pool.query(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = $${params.length}
       RETURNING id, title, message, button_text, button_link, is_active, placement, start_at, end_at, updated_at`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    await logAdminAudit(pool, {
      adminId: req.adminId, action: 'announcement.updated', entityType: 'announcement', entityId: id,
      metadata: { fields: Object.keys(d) }, req,
    });
    res.json({ announcement: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/announcements/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    await logAdminAudit(pool, {
      adminId: req.adminId, action: 'announcement.deleted', entityType: 'announcement', entityId: id,
      metadata: {}, req,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Admin subscriptions, plans, payments, CRM, reporting and audit ─────────
router.get('/admin/subscriptions', requireAdminAuth, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    if (!process.env.DATABASE_URL) {
      return res.json({
        subscriptions: mockAdminDb.subscriptions,
        pagination: paginationPayload(page, pageSize, mockAdminDb.subscriptions.length),
      });
    }
    const params = [];
    const conditions = [];
    if (req.query.search?.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR p.display_name ILIKE $${params.length})`);
    }
    if (req.query.status?.trim()) { params.push(req.query.status.trim()); conditions.push(`s.status = $${params.length}`); }
    if (req.query.plan?.trim()) { params.push(req.query.plan.trim()); conditions.push(`p.name::text = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const list = await pool.query(
      `SELECT s.id, s.status, s.price_at_signup, s.renews_on, s.payment_method, s.auto_renew, s.created_at, s.updated_at,
              u.id AS user_id, u.full_name, u.email, p.name AS plan, p.display_name
       FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id ${where}
       ORDER BY s.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) AS total FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id ${where}`, params);
    res.json({ subscriptions: list.rows, pagination: paginationPayload(page, pageSize, count.rows[0]?.total || 0) });
  } catch (err) { next(err); }
});

router.get('/admin/subscriptions/:id', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      const sub = mockAdminDb.subscriptions.find(s => s.id === req.params.id) || mockAdminDb.subscriptions[0];
      return res.json({
        subscription: { ...sub, display_name: sub.plan_name, price_at_signup: sub.price, renews_on: sub.current_period_end, payment_method: 'Card / UPI', auto_renew: true },
        invoices: mockAdminDb.payments,
      });
    }
    const subscription = await pool.query(
      `SELECT s.*, u.id AS user_id, u.full_name, u.email, u.is_active AS user_active, p.name AS plan, p.display_name, p.price_inr
       FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id WHERE s.id=$1`, [req.params.id]
    );
    if (!subscription.rows[0]) return res.status(404).json({ error: 'Subscription not found' });
    const invoices = await pool.query(`SELECT id, amount, status, plan_name, invoice_number, billing_date, created_at FROM billing_history WHERE subscription_id=$1 ORDER BY billing_date DESC`, [req.params.id]);
    res.json({ subscription: subscription.rows[0], invoices: invoices.rows });
  } catch (err) { next(err); }
});

router.patch('/admin/subscriptions/:id/cancel', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ subscription: { id: req.params.id, status: 'cancelled', auto_renew: false } });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE subscriptions SET status='cancelled', auto_renew=FALSE, updated_at=NOW()
         WHERE id=$1 AND status IN ('active','pending')
         RETURNING id, user_id, status, auto_renew, renews_on`, [req.params.id]
      );
      if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Only active or pending subscriptions can be cancelled' }); }
      await logAdminAudit(client, { adminId: req.adminId, action: 'subscription.cancelled', entityType: 'subscription', entityId: result.rows[0].id, metadata: { userId: result.rows[0].user_id }, req });
      await client.query('COMMIT');
      res.json({ subscription: result.rows[0] });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (err) { next(err); }
});

router.get('/admin/plans', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({
        plans: mockAdminDb.plans.map(p => ({
          ...p,
          billing_cycle: p.interval,
          active_subscriptions: p.name === 'Pro Member' ? 48 : p.name === 'Enterprise VIP' ? 24 : 10,
        })),
      });
    }
    const result = await pool.query(
      `SELECT p.*, COUNT(s.id) FILTER (WHERE s.status='active') AS active_subscriptions
       FROM plans p LEFT JOIN subscriptions s ON s.plan_id=p.id GROUP BY p.id ORDER BY p.sort_order`
    );
    res.json({ plans: result.rows });
  } catch (err) { next(err); }
});

router.patch('/admin/plans/:id', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ plan: { id: req.params.id, ...req.body } });
    }
    const schema = z.object({
      displayName: z.string().trim().min(1).max(255).optional(),
      priceInr: z.number().min(0).max(99999999).optional(),
      billingCycle: z.string().trim().min(1).max(20).optional(),
      features: z.array(z.string().max(500)).max(100).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(100000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed' });
    const fields = []; const params = []; const d = parsed.data;
    if (d.displayName !== undefined) { params.push(d.displayName); fields.push(`display_name=$${params.length}`); }
    if (d.priceInr !== undefined) { params.push(d.priceInr); fields.push(`price_inr=$${params.length}`); }
    if (d.billingCycle !== undefined) { params.push(d.billingCycle); fields.push(`billing_cycle=$${params.length}`); }
    if (d.features !== undefined) { params.push(JSON.stringify(d.features)); fields.push(`features=$${params.length}::jsonb`); }
    if (d.isActive !== undefined) { params.push(d.isActive); fields.push(`is_active=$${params.length}`); }
    if (d.sortOrder !== undefined) { params.push(d.sortOrder); fields.push(`sort_order=$${params.length}`); }
    if (!fields.length) return res.status(400).json({ error: 'No editable fields supplied' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); params.push(req.params.id);
      const result = await client.query(`UPDATE plans SET ${fields.join(', ')} WHERE id=$${params.length} RETURNING id,name,display_name,price_inr,billing_cycle,features,is_active,sort_order`, params);
      if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plan not found' }); }
      await logAdminAudit(client, { adminId:req.adminId, action:'plan.updated', entityType:'plan', entityId:req.params.id, metadata:{ fields:Object.keys(d) }, req });
      await client.query('COMMIT'); res.json({ plan: result.rows[0] });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (err) { next(err); }
});

router.get('/admin/payments', requireAdminAuth, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    if (!process.env.DATABASE_URL) {
      return res.json({
        payments: mockAdminDb.payments.map(p => ({
          ...p,
          full_name: p.user_name,
          email: p.user_email,
        })),
        pagination: paginationPayload(page, pageSize, mockAdminDb.payments.length),
      });
    }
    const params=[]; const conditions=[];
    if (req.query.search?.trim()) { params.push(`%${req.query.search.trim()}%`); conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR bh.invoice_number ILIKE $${params.length} OR bh.plan_name ILIKE $${params.length})`); }
    if (req.query.status?.trim()) { params.push(req.query.status.trim()); conditions.push(`bh.status=$${params.length}`); }
    const where=conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const list=await pool.query(`SELECT bh.*,u.full_name,u.email,s.id AS subscription_id,p.name AS current_plan FROM billing_history bh JOIN users u ON u.id=bh.user_id LEFT JOIN subscriptions s ON s.id=bh.subscription_id LEFT JOIN plans p ON p.id=s.plan_id ${where} ORDER BY bh.billing_date DESC,bh.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,pageSize,offset]);
    const count=await pool.query(`SELECT COUNT(*) AS total FROM billing_history bh JOIN users u ON u.id=bh.user_id ${where}`,params);
    res.json({ payments:list.rows, pagination:paginationPayload(page,pageSize,count.rows[0]?.total || 0) });
  } catch(err){next(err);}
});

router.get('/admin/payments/:id', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      const p = mockAdminDb.payments.find(x => x.id === req.params.id) || mockAdminDb.payments[0];
      return res.json({
        payment: {
          ...p,
          full_name: p.user_name,
          email: p.user_email,
          payment_method: p.method,
        },
      });
    }
    const result=await pool.query(`SELECT bh.*,u.id AS user_id,u.full_name,u.email,s.status AS subscription_status,s.payment_method,p.name AS current_plan,p.display_name FROM billing_history bh JOIN users u ON u.id=bh.user_id LEFT JOIN subscriptions s ON s.id=bh.subscription_id LEFT JOIN plans p ON p.id=s.plan_id WHERE bh.id=$1`,[req.params.id]);
    if(!result.rows[0]) return res.status(404).json({error:'Payment record not found'});
    res.json({payment:result.rows[0]});
  } catch(err){next(err);}
});

router.get('/admin/leads', requireAdminAuth, async (req,res,next)=>{
  try {
    const {page,pageSize,offset}=parsePagination(req.query);
    if (!process.env.DATABASE_URL) {
      return res.json({
        leads: mockAdminDb.crmLeads.map(l => ({ ...l, open_followups: 1, contact_name: l.name })),
        pagination: paginationPayload(page,pageSize,mockAdminDb.crmLeads.length),
      });
    }
    const params=[]; const conditions=[];
    if(req.query.search?.trim()){params.push(`%${req.query.search.trim()}%`);conditions.push(`(cl.company_name ILIKE $${params.length} OR cl.contact_name ILIKE $${params.length} OR cl.email ILIKE $${params.length})`);}
    if(req.query.status?.trim()){params.push(req.query.status.trim());conditions.push(`cl.status=$${params.length}`);}
    if(req.query.score?.trim()){params.push(req.query.score.trim());conditions.push(`cl.lead_score=$${params.length}`);}
    const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';
    const list=await pool.query(`SELECT cl.*,u.full_name AS assigned_executive_name,(SELECT COUNT(*) FROM crm_lead_followups f WHERE f.lead_id=cl.id AND NOT f.completed) AS open_followups FROM crm_leads cl LEFT JOIN users u ON u.id=cl.assigned_executive ${where} ORDER BY cl.updated_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,pageSize,offset]);
    const count=await pool.query(`SELECT COUNT(*) AS total FROM crm_leads cl ${where}`,params); res.json({leads:list.rows,pagination:paginationPayload(page,pageSize,count.rows[0]?.total || 0)});
  }catch(err){next(err);}
});

router.get('/admin/leads/:id', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      const l = mockAdminDb.crmLeads.find(x => x.id === req.params.id) || mockAdminDb.crmLeads[0];
      return res.json({
        lead: { ...l, contact_name: l.name, lead_score: 'HOT' },
        activities: [{ activity: 'Inquiry submitted from contact form', created_at: l.created_at }],
        notes: [{ note: 'Interested in enterprise ledger integration', created_at: l.created_at }],
        followups: [{ id: 'f_1', followup_date: '2026-09-05', followup_type: 'Call', completed: false, notes: 'Follow up on proposal demo' }],
      });
    }
    const lead=await pool.query(`SELECT cl.*,u.full_name AS assigned_executive_name FROM crm_leads cl LEFT JOIN users u ON u.id=cl.assigned_executive WHERE cl.id=$1`,[req.params.id]); if(!lead.rows[0]) return res.status(404).json({error:'Lead not found'}); const [activities,notes,followups]=await Promise.all([pool.query(`SELECT activity,created_at FROM lead_activities WHERE lead_id=$1 ORDER BY created_at DESC`,[req.params.id]),pool.query(`SELECT note,created_at FROM crm_lead_notes WHERE lead_id=$1 ORDER BY created_at DESC`,[req.params.id]),pool.query(`SELECT id,followup_date,followup_type,notes,completed,created_at FROM crm_lead_followups WHERE lead_id=$1 ORDER BY followup_date ASC`,[req.params.id])]); res.json({lead:lead.rows[0],activities:activities.rows,notes:notes.rows,followups:followups.rows}); }catch(err){next(err);}
});

router.patch('/admin/leads/:id', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ lead: { id: req.params.id, ...req.body } });
    }
    const schema=z.object({status:z.enum(['New','Called','Connected','Interested','Converted','Lost']).optional(),leadScore:z.enum(['HOT','WARM','COLD']).optional(),notes:z.string().trim().max(5000).nullable().optional(),nextFollowupDate:z.string().date().nullable().optional()}); const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Validation failed'}); const d=parsed.data; const fields=[];const params=[]; if(d.status!==undefined){params.push(d.status);fields.push(`status=$${params.length}`);} if(d.leadScore!==undefined){params.push(d.leadScore);fields.push(`lead_score=$${params.length}`);} if(d.notes!==undefined){params.push(d.notes);fields.push(`notes=$${params.length}`);} if(d.nextFollowupDate!==undefined){params.push(d.nextFollowupDate);fields.push(`next_followup_date=$${params.length}`);} if(!fields.length)return res.status(400).json({error:'No editable fields supplied'}); const client=await pool.connect();try{await client.query('BEGIN');params.push(req.params.id);const result=await client.query(`UPDATE crm_leads SET ${fields.join(', ')},last_activity_at=NOW(),updated_at=NOW() WHERE id=$${params.length} RETURNING id,status,lead_score,notes,next_followup_date`,params);if(!result.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Lead not found'});}await logAdminAudit(client,{adminId:req.adminId,action:'lead.updated',entityType:'crm_lead',entityId:req.params.id,metadata:{fields:Object.keys(d)},req});await client.query('COMMIT');res.json({lead:result.rows[0]});}catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
  }catch(err){next(err);}
});

router.get('/admin/reports', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({
        users: { total: mockAdminDb.users.length + 137, active: 64, new_30d: 28 },
        subscriptions: { total: 96, active: 82, cancelled: 14 },
        revenue: { paid_total: 384500, paid_30d: 124500, paid_count: 86 },
        planDistribution: [
          { name: 'Pro Member', display_name: 'Pro Trader & Ledger', active_subscriptions: 48 },
          { name: 'Enterprise VIP', display_name: 'Enterprise Advisory', active_subscriptions: 24 },
          { name: 'Free Trial', display_name: 'Free Starter Tier', active_subscriptions: 10 },
        ],
        recentActivity: [
          { type: 'login', full_name: 'Navin Chakraborty', email: 'navi@kepwe.com', created_at: new Date().toISOString() },
          { type: 'invoice', full_name: 'Aditi Sharma', email: 'aditi.sharma@techcorp.in', created_at: new Date(Date.now() - 3600000).toISOString() },
          { type: 'login', full_name: 'Rahul Verma', email: 'rahul.v@apexglobal.com', created_at: new Date(Date.now() - 7200000).toISOString() },
        ],
      });
    }
    const [users,subscriptions,revenue,plans,activity]=await Promise.all([
      pool.query(`SELECT COUNT(*) AS total,COUNT(*) FILTER (WHERE is_active) AS active,COUNT(*) FILTER (WHERE created_at>=NOW()-INTERVAL '30 days') AS new_30d FROM users`),
      pool.query(`SELECT COUNT(*) AS total,COUNT(*) FILTER (WHERE status='active') AS active,COUNT(*) FILTER (WHERE status='cancelled') AS cancelled FROM subscriptions`),
      pool.query(`SELECT COALESCE(SUM(amount) FILTER (WHERE status='Paid'),0) AS paid_total,COALESCE(SUM(amount) FILTER (WHERE status='Paid' AND billing_date>=CURRENT_DATE-INTERVAL '30 days'),0) AS paid_30d,COUNT(*) FILTER (WHERE status='Paid') AS paid_count FROM billing_history`),
      pool.query(`SELECT p.name,p.display_name,COUNT(s.id) FILTER (WHERE s.status='active') AS active_subscriptions FROM plans p LEFT JOIN subscriptions s ON s.plan_id=p.id GROUP BY p.id ORDER BY p.sort_order`),
      pool.query(`SELECT 'login' AS type,u.full_name,u.email,us.created_at FROM user_sessions us JOIN users u ON u.id=us.user_id UNION ALL SELECT 'invoice',u.full_name,u.email,bh.created_at FROM billing_history bh JOIN users u ON u.id=bh.user_id ORDER BY created_at DESC LIMIT 30`),
    ]); res.json({users:users.rows[0],subscriptions:subscriptions.rows[0],revenue:revenue.rows[0],planDistribution:plans.rows,recentActivity:activity.rows});
  }catch(err){next(err);}
});

router.get('/admin/audit-logs', requireAdminAuth, async (req,res,next)=>{
  try {
    const {page,pageSize,offset}=parsePagination(req.query);
    if (!process.env.DATABASE_URL) {
      return res.json({
        logs: mockAdminDb.auditLogs,
        pagination: paginationPayload(page,pageSize,mockAdminDb.auditLogs.length),
      });
    }
    const params=[];const conditions=[]; if(req.query.action?.trim()){params.push(req.query.action.trim());conditions.push(`l.action=$${params.length}`);}if(req.query.entityType?.trim()){params.push(req.query.entityType.trim());conditions.push(`l.entity_type=$${params.length}`);}const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';const list=await pool.query(`SELECT l.id,l.action,l.entity_type,l.entity_id,l.metadata,l.created_at,a.username,a.display_name FROM admin_audit_logs l LEFT JOIN admin_users a ON a.id=l.admin_id ${where} ORDER BY l.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,pageSize,offset]);const count=await pool.query(`SELECT COUNT(*) AS total FROM admin_audit_logs l ${where}`,params);res.json({logs:list.rows,pagination:paginationPayload(page,pageSize,count.rows[0]?.total || 0)});
  }catch(err){next(err);}
});

router.get('/admin/users/:id/private-data', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ notes: [], tags: [{ tag: 'Verified Trader' }, { tag: 'Ledger Pro' }] });
    }
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });
    const [notes, tags] = await Promise.all([
      pool.query(`SELECT n.id, n.note, n.created_at, n.updated_at, a.display_name AS admin_name FROM admin_user_notes n LEFT JOIN admin_users a ON a.id=n.admin_id WHERE n.user_id=$1 ORDER BY n.updated_at DESC`, [req.params.id]),
      pool.query('SELECT id, tag, created_at FROM admin_user_tags WHERE user_id=$1 ORDER BY tag', [req.params.id]),
    ]);
    res.json({ notes: notes.rows, tags: tags.rows });
  } catch (err) { next(err); }
});

router.post('/admin/users/:id/notes', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(201).json({ note: { id: 'note_' + Date.now(), note: req.body.note, created_at: new Date().toISOString() } });
    }
    const parsed = z.object({ note: z.string().trim().min(1).max(5000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed' });
    const result = await pool.query(`INSERT INTO admin_user_notes (user_id, admin_id, note) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM users WHERE id=$1) RETURNING id, note, created_at, updated_at`, [req.params.id, req.adminId, parsed.data.note]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    await logAdminAudit(pool, { adminId:req.adminId, action:'user.note.created', entityType:'user', entityId:req.params.id, metadata:{ noteId:result.rows[0].id }, req });
    res.status(201).json({ note: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/admin/users/:userId/notes/:noteId', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true });
    }
    const result = await pool.query('DELETE FROM admin_user_notes WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.noteId, req.params.userId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });
    await logAdminAudit(pool, { adminId:req.adminId, action:'user.note.deleted', entityType:'user', entityId:req.params.userId, metadata:{ noteId:req.params.noteId }, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/admin/users/:id/tags', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ tags: (req.body.tags || []).map(tag => ({ tag })) });
    }
    const parsed = z.object({ tags: z.array(z.string().trim().min(1).max(40)).max(20) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const exists = await client.query('SELECT id FROM users WHERE id=$1', [req.params.id]);
      if (!exists.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error:'User not found' }); }
      await client.query('DELETE FROM admin_user_tags WHERE user_id=$1', [req.params.id]);
      for (const tag of [...new Set(parsed.data.tags)]) await client.query('INSERT INTO admin_user_tags (user_id, tag, created_by) VALUES ($1,$2,$3)', [req.params.id, tag, req.adminId]);
      await logAdminAudit(client, { adminId:req.adminId, action:'user.tags.updated', entityType:'user', entityId:req.params.id, metadata:{ tags: [...new Set(parsed.data.tags)] }, req });
      await client.query('COMMIT');
      res.json({ tags: parsed.data.tags.map((tag) => ({ tag })) });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (err) { next(err); }
});

router.get('/admin/revenue-analytics', requireAdminAuth, async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    if (!process.env.DATABASE_URL) {
      return res.json({
        range: range.range,
        daily: [
          { period: '2026-08-28', revenue: 14999 },
          { period: '2026-08-29', revenue: 24998 },
          { period: '2026-08-30', revenue: 19999 },
          { period: '2026-08-31', revenue: 29999 },
          { period: '2026-09-01', revenue: 34999 },
        ],
        weekly: [
          { period: '2026-08-10', revenue: 65000 },
          { period: '2026-08-17', revenue: 98000 },
          { period: '2026-08-24', revenue: 135000 },
          { period: '2026-08-31', revenue: 86500 },
        ],
        monthly: [
          { period: '2026-06', revenue: 180000 },
          { period: '2026-07', revenue: 245000 },
          { period: '2026-08', revenue: 384500 },
        ],
        activeSubscriptions: mockAdminDb.subscriptions.length + 80,
        trialToPaidConversion: 42.5,
      });
    }
    const from = range.range === 'custom' ? range.from : range.range === 'today' ? 'today' : range.range === '7d' ? '7 days' : '30 days';
    const clause = range.range === 'custom' ? "billing_date >= $1::date AND billing_date < ($2::date + INTERVAL '1 day')" : range.range === 'today' ? 'billing_date >= CURRENT_DATE' : `billing_date >= CURRENT_DATE - INTERVAL '${from}'`;
    const params = range.range === 'custom' ? [range.from, range.to] : [];
    const [daily, weekly, monthly, active, trials, paid] = await Promise.all([
      pool.query(`SELECT billing_date AS period, COALESCE(SUM(amount) FILTER (WHERE status='Paid'),0) AS revenue FROM billing_history WHERE ${clause} GROUP BY billing_date ORDER BY billing_date`, params),
      pool.query(`SELECT DATE_TRUNC('week', billing_date)::date AS period, COALESCE(SUM(amount) FILTER (WHERE status='Paid'),0) AS revenue FROM billing_history WHERE ${clause} GROUP BY 1 ORDER BY 1`, params),
      pool.query(`SELECT DATE_TRUNC('month', billing_date)::date AS period, COALESCE(SUM(amount) FILTER (WHERE status='Paid'),0) AS revenue FROM billing_history WHERE ${clause} GROUP BY 1 ORDER BY 1`, params),
      pool.query("SELECT COUNT(*) AS count FROM subscriptions WHERE status='active'"),
      pool.query("SELECT COUNT(*) AS count FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE p.name='Free Trial'"),
      pool.query("SELECT COUNT(*) AS count FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE p.name <> 'Free Trial' AND s.status IN ('active','cancelled')"),
    ]);
    const trialCount = Number(trials.rows[0]?.count || 0); const paidCount = Number(paid.rows[0]?.count || 0);
    res.json({ range: range.range, daily: daily.rows, weekly: weekly.rows, monthly: monthly.rows, activeSubscriptions: Number(active.rows[0]?.count || 0), trialToPaidConversion: trialCount ? Math.round((paidCount / (trialCount + paidCount)) * 10000) / 100 : 0 });
  } catch (err) { next(err); }
});

router.get('/admin/notifications', requireAdminAuth, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    if (!process.env.DATABASE_URL) {
      return res.json({
        notifications: mockAdminDb.notifications,
        pagination: paginationPayload(page, pageSize, mockAdminDb.notifications.length),
      });
    }
    const params=[]; const conditions=[];
    await pool.query(`INSERT INTO admin_notifications (type, title, message, entity_type, entity_id)
      SELECT 'expiry', 'Subscription expiring', u.full_name || ' subscription renews on ' || s.renews_on::text, 'subscription', s.id
      FROM subscriptions s JOIN users u ON u.id=s.user_id
      WHERE s.status='active' AND s.renews_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        AND NOT EXISTS (SELECT 1 FROM admin_notifications n WHERE n.type='expiry' AND n.entity_id=s.id AND n.created_at >= NOW() - INTERVAL '1 day')`);
    if (req.query.unread === 'true') conditions.push('n.is_read=FALSE');
    const where=conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const list=await pool.query(`SELECT n.id,n.type,n.title,n.message,n.entity_type,n.entity_id,n.is_read,n.created_at FROM admin_notifications n ${where} ORDER BY n.created_at DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
    const count=await pool.query(`SELECT COUNT(*) AS total FROM admin_notifications n ${where}`, params);
    res.json({ notifications:list.rows, pagination:paginationPayload(page,pageSize,count.rows[0]?.total || 0) });
  } catch(err){next(err);}
});

router.patch('/admin/notifications/:id/read', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ notification: { id: req.params.id, is_read: true } });
    }
    const result=await pool.query('UPDATE admin_notifications SET is_read=TRUE WHERE id=$1 RETURNING id,is_read',[req.params.id]); if(!result.rows[0]) return res.status(404).json({error:'Notification not found'}); res.json({notification:result.rows[0]});
  } catch(err){next(err);}
});

router.get('/admin/export/users.csv', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      return sendCsv(res,'users.csv',['id','full_name','email','mobile','role','plan','is_active','created_at','last_login'],mockAdminDb.users);
    }
    const result=await pool.query(`SELECT u.id,u.full_name,u.email,u.mobile,u.role,u.plan,u.is_active,u.created_at,(SELECT MAX(created_at) FROM user_sessions WHERE user_id=u.id) AS last_login FROM users u ORDER BY u.created_at DESC`); return sendCsv(res,'users.csv',['id','full_name','email','mobile','role','plan','is_active','created_at','last_login'],result.rows);
  } catch(err){next(err);}
});

router.get('/admin/export/payments.csv', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      return sendCsv(res,'payments.csv',['id','invoice_number','amount','status','plan_name','billing_date','full_name','email'],mockAdminDb.payments);
    }
    const result=await pool.query(`SELECT bh.id,bh.invoice_number,bh.amount,bh.status,bh.plan_name,bh.billing_date,u.full_name,u.email FROM billing_history bh JOIN users u ON u.id=bh.user_id ORDER BY bh.billing_date DESC`); return sendCsv(res,'payments.csv',['id','invoice_number','amount','status','plan_name','billing_date','full_name','email'],result.rows);
  } catch(err){next(err);}
});

router.get('/admin/export/subscriptions.csv', requireAdminAuth, async (req,res,next)=>{
  try {
    if (!process.env.DATABASE_URL) {
      return sendCsv(res,'subscriptions.csv',['id','full_name','email','plan','status','price_at_signup','renews_on','auto_renew','created_at'],mockAdminDb.subscriptions);
    }
    const result=await pool.query(`SELECT s.id,u.full_name,u.email,p.name AS plan,s.status,s.price_at_signup,s.renews_on,s.auto_renew,s.created_at FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id ORDER BY s.updated_at DESC`); return sendCsv(res,'subscriptions.csv',['id','full_name','email','plan','status','price_at_signup','renews_on','auto_renew','created_at'],result.rows);
  } catch(err){next(err);}
});

// ── Admin Algo Operations ────────────────────────────────────────────────────
// These endpoints expose operational data only. Broker credentials and tokens
// are never selected from the database or returned to the admin client.
router.get('/admin/algo/overview', requireAdminAuth, async (req, res, next) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({
        overview: {
          active_algos: 3,
          configured_algos: 8,
          open_positions: 4,
          pending_orders: 0,
          today_trades: 12,
          today_pnl: 18450.50,
          risk_events_24h: 0,
        },
        brokers: [],
        positions: [],
        orders: [],
        trades: [],
        risks: [],
      });
    }
    const [summary, brokers, positions, orders, trades, risks] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE s.status = 'ACTIVE')::int AS active_algos,
           COUNT(*)::int AS configured_algos,
           (SELECT COUNT(*) FROM algo_positions WHERE status = 'OPEN')::int AS open_positions,
           (SELECT COUNT(*) FROM algo_orders WHERE status IN ('CREATED','SUBMITTED','PARTIALLY_FILLED'))::int AS pending_orders,
           (SELECT COUNT(*) FROM paper_trades WHERE opened_at::date = CURRENT_DATE)::int AS today_trades,
           (SELECT COALESCE(SUM(pnl), 0) FROM paper_trades WHERE status = 'CLOSED' AND closed_at::date = CURRENT_DATE) AS today_pnl,
           (SELECT COUNT(*) FROM risk_events WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS risk_events_24h
         FROM algo_states s`,
      ),
      pool.query(
        `SELECT broker, connection_mode, status, COUNT(*)::int AS accounts
         FROM broker_accounts GROUP BY broker, connection_mode, status ORDER BY broker`,
      ),
      pool.query(
        `SELECT p.id, p.user_id, u.email, p.symbol, p.side, p.quantity, p.entry_price,
                p.current_price, p.pnl, p.status, p.opened_at
         FROM algo_positions p JOIN users u ON u.id = p.user_id
         WHERE p.status = 'OPEN' ORDER BY p.opened_at DESC LIMIT 100`,
      ),
      pool.query(
        `SELECT o.id, o.user_id, u.email, o.execution_mode, o.instrument, o.side,
                o.quantity, o.price, o.status, o.rejection_reason, o.created_at, o.updated_at
         FROM algo_orders o JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC LIMIT 100`,
      ),
      pool.query(
        `SELECT t.id, t.user_id, u.email, t.symbol, t.side, t.quantity,
                t.entry_price, t.exit_price, t.pnl, t.status, t.traded_at
         FROM algo_trades t JOIN users u ON u.id = t.user_id
         ORDER BY t.traded_at DESC LIMIT 100`,
      ),
      pool.query(
        `SELECT r.id, r.user_id, u.email, r.event_type, r.reason, r.severity,
                r.metadata, r.created_at
         FROM risk_events r LEFT JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC LIMIT 100`,
      ),
    ]);
    const row = summary.rows[0];
    res.json({
      summary: {
        activeAlgos: Number(row.active_algos),
        configuredAlgos: Number(row.configured_algos),
        openPositions: Number(row.open_positions),
        pendingOrders: Number(row.pending_orders),
        todayTrades: Number(row.today_trades),
        todayPnl: Number(row.today_pnl),
        riskEvents24h: Number(row.risk_events_24h),
      },
      brokers: brokers.rows,
      positions: positions.rows,
      orders: orders.rows,
      trades: trades.rows,
      riskEvents: risks.rows,
      liveExecutionEnabled: false,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/algo/risk-events', requireAdminAuth, async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(10, Number.parseInt(req.query.limit, 10) || 50));
    const result = await pool.query(
      `SELECT r.id, r.user_id, u.email, r.event_type, r.reason, r.severity,
              r.metadata, r.created_at
       FROM risk_events r LEFT JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC LIMIT $1`,
      [limit],
    );
    res.json({ events: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/algo/users/:userId/stop', requireAdminAuth, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const state = await client.query(
        `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
         WHERE user_id = $1 RETURNING user_id, status`,
        [userId],
      );
      if (!state.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Algo state not found for user' });
      }
      await client.query(
        `INSERT INTO risk_events (user_id, event_type, reason, severity, metadata)
         VALUES ($1, 'ADMIN_STOP', 'Algo stopped by an administrator', 'CRITICAL', $2::jsonb)`,
        [userId, JSON.stringify({ adminId: req.adminId })],
      );
      await client.query(
        `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
         VALUES ($1, 'ADMIN_STOP', 'Algo stopped by an administrator', $2::jsonb)`,
        [userId, JSON.stringify({ adminId: req.adminId })],
      );
      await logAdminAudit(client, {
        adminId: req.adminId,
        action: 'algo.user_stopped',
        entityType: 'user',
        entityId: userId,
        metadata: {},
        req,
      });
      await client.query('COMMIT');
      res.json({ userId, status: 'STOPPED' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.post('/admin/algo/kill-switch', requireSuperAdmin, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const stopped = await client.query(
        `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
         WHERE status = 'ACTIVE' RETURNING user_id`,
      );
      for (const row of stopped.rows) {
        await client.query(
          `INSERT INTO risk_events (user_id, event_type, reason, severity, metadata)
           VALUES ($1, 'GLOBAL_KILL_SWITCH', 'Global algo kill switch activated', 'CRITICAL', $2::jsonb)`,
          [row.user_id, JSON.stringify({ adminId: req.adminId })],
        );
        await client.query(
          `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
           VALUES ($1, 'GLOBAL_KILL_SWITCH', 'Global algo kill switch activated', $2::jsonb)`,
          [row.user_id, JSON.stringify({ adminId: req.adminId })],
        );
      }
      await logAdminAudit(client, {
        adminId: req.adminId,
        action: 'algo.global_kill_switch',
        entityType: 'algo',
        entityId: null,
        metadata: { stoppedUsers: stopped.rows.length },
        req,
      });
      await client.query('COMMIT');
      res.json({ stoppedUsers: stopped.rows.length, status: 'STOPPED' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ── Public endpoints (no admin auth) ────────────────────────────────────────
// Active announcements for the frontend (public)
router.get('/public/announcements', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, message, button_text, button_link, placement
       FROM announcements
       WHERE is_active = TRUE
         AND (start_at IS NULL OR start_at <= NOW())
         AND (end_at IS NULL OR end_at >= NOW())
       ORDER BY created_at DESC`
    );
    res.json({ announcements: result.rows });
  } catch (err) {
    next(err);
  }
});

// Enabled website sections for the frontend (public)
router.get('/public/website-sections', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT key, label, route, is_enabled, display_title, display_subtitle, content, visibility
       FROM website_sections WHERE is_enabled = TRUE ORDER BY sort_order`
    );
    res.json({ sections: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
