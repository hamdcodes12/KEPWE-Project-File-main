import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { createCompanyForUser, getPrimaryCompanyForUser, listCompaniesForUser, serializeCompany } from '../services/companies.service.js';

const router = Router();

const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(255),
});

/**
 * GET /api/companies
 * Returns only the companies the authenticated user is a member of.
 * Identity is derived from the verified JWT (req.userId) — never from
 * anything the client supplies.
 */
router.get('/companies', requireAuth, async (req, res, next) => {
  try {
    const rows = await listCompaniesForUser(req.userId);
    res.json({
      companies: rows.map((r) => ({
        ...serializeCompany(r),
        isOwner: r.is_owner,
        role: r.member_role,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/companies
 * Creates the signed-in user's primary company and seeds its checklist.
 */
router.post('/companies', requireAuth, validateBody(createCompanySchema), async (req, res, next) => {
  try {
    const existing = await getPrimaryCompanyForUser(req.userId);
    if (existing) return res.status(409).json({ error: 'A primary company already exists for this account.' });

    const company = await createCompanyForUser(req.userId, { name: req.validatedBody.name });
    res.status(201).json({ company: serializeCompany(company) });
  } catch (err) {
    next(err);
  }
});

export default router;
