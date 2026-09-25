import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/admin/founder-dashboard/summary
 * Staff-only. Every figure here is computed live from crm_leads,
 * lead_activities, subscriptions, and plans — there is no hardcoded
 * "12-stage incorporation funnel" because no incorporation-feed data
 * source exists in this system. Instead this reflects the CRM pipeline
 * KEPWE actually tracks end-to-end (lead -> called -> connected ->
 * interested -> converted), which is real and verifiable.
 */
router.get('/admin/founder-dashboard/summary', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const funnelResult = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status IN ('Called','Connected','Interested','Converted')) AS called,
         COUNT(*) FILTER (WHERE status IN ('Connected','Interested','Converted')) AS connected,
         COUNT(*) FILTER (WHERE status IN ('Interested','Converted')) AS interested,
         COUNT(*) FILTER (WHERE status = 'Converted') AS converted,
         COUNT(*) FILTER (WHERE status = 'Lost') AS lost
       FROM crm_leads`
    );
    const f = funnelResult.rows[0];
    const total = Number(f.total) || 0;
    const pct = (n) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

    const journeyStages = [
      { stage: 'New Leads', count: total, conv: '100%', status: 'Captured in CRM' },
      { stage: 'Called', count: Number(f.called), conv: pct(Number(f.called)), status: 'Outreach in progress' },
      { stage: 'Connected', count: Number(f.connected), conv: pct(Number(f.connected)), status: 'Conversation held' },
      { stage: 'Interested', count: Number(f.interested), conv: pct(Number(f.interested)), status: 'Qualified' },
      { stage: 'Converted', count: Number(f.converted), conv: pct(Number(f.converted)), status: 'Active customer' },
      { stage: 'Lost', count: Number(f.lost), conv: pct(Number(f.lost)), status: 'Disqualified' },
    ];

    const salesTeamResult = await pool.query(
      `SELECT
         u.id,
         u.full_name AS name,
         COUNT(DISTINCT la.id) AS calls,
         COUNT(DISTINCT cl.id) FILTER (WHERE cl.status IN ('Connected','Interested','Converted')) AS connected,
         COUNT(DISTINCT cl.id) FILTER (WHERE cl.status = 'Converted') AS converted
       FROM users u
       LEFT JOIN crm_leads cl ON cl.assigned_executive = u.id
       LEFT JOIN lead_activities la ON la.performed_by = u.id
       WHERE u.role IN ('sales_agent', 'admin')
       GROUP BY u.id, u.full_name
       ORDER BY converted DESC, connected DESC`
    );

    const productMixResult = await pool.query(
      `SELECT p.display_name AS name, p.price_inr AS price, COUNT(s.id) AS count
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.status = 'active'
       GROUP BY p.id, p.display_name, p.price_inr
       ORDER BY count DESC`
    );
    const totalActiveSubs = productMixResult.rows.reduce((sum, r) => sum + Number(r.count), 0);
    const productMix = productMixResult.rows.map((r) => ({
      name: `${r.name} (₹${Number(r.price).toLocaleString('en-IN')}/mo)`,
      pct: totalActiveSubs > 0 ? Math.round((Number(r.count) / totalActiveSubs) * 100) : 0,
      count: Number(r.count),
    }));

    res.json({
      journeyStages,
      funnel: {
        leads: total,
        calls: Number(f.called),
        connected: Number(f.connected),
        interested: Number(f.interested),
        customers: Number(f.converted),
      },
      salesTeam: salesTeamResult.rows.map((r) => ({
        name: r.name,
        calls: Number(r.calls),
        connected: Number(r.connected),
        converted: Number(r.converted),
      })),
      productMix,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
