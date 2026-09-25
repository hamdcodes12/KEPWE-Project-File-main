import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireProductAccess } from '../middleware/product-auth.js';
import { pool } from '../config/db.js';

const router = Router();

// Enforce Credit product authorization on all endpoints
router.use(requireProductAccess('credit'));

/**
 * GET /api/credit/workspace
 * Workspace overview for authorized Kepwe Credit users.
 */
router.get('/workspace', async (req, res, next) => {
  try {
    res.json({
      product: 'credit',
      status: 'active',
      user: {
        id: req.user.id,
        name: req.user.full_name,
        email: req.user.email,
      },
      creditLines: [
        {
          id: 'CL-KEPWE-001',
          name: 'SME Revolving Working Capital',
          approvedLimit: 2500000,
          utilizedAmount: 450000,
          availableLimit: 2050000,
          interestRate: '11.5% p.a.',
          status: 'ACTIVE',
        },
      ],
      metrics: {
        creditScore: 785,
        repaymentRating: 'EXCELLENT',
        nextPaymentDueDate: '2026-10-05',
        nextPaymentAmount: 42500,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/credit/applications
 * List all credit applications for current user.
 */
router.get('/applications', async (req, res, next) => {
  try {
    res.json({
      applications: [
        {
          id: 'APP-CREDIT-7890',
          type: 'Invoice Discounting Line',
          requestedAmount: 1500000,
          status: 'UNDER_REVIEW',
          submittedAt: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    next(err);
  }
});

const applicationSchema = z.object({
  loanType: z.enum(['working_capital', 'term_loan', 'invoice_discounting', 'equipment_finance']).default('working_capital'),
  amount: z.number().positive('Requested amount must be positive'),
  tenorMonths: z.number().int().min(1).max(120).default(12),
  gstin: z.string().trim().max(15).optional().nullable(),
  annualTurnover: z.number().nonnegative().optional(),
});

/**
 * POST /api/credit/applications
 * Submit a new credit application.
 */
router.post('/applications', validateBody(applicationSchema), async (req, res, next) => {
  try {
    const data = req.validatedBody;
    res.status(201).json({
      success: true,
      applicationId: `APP-${Date.now()}`,
      status: 'SUBMITTED',
      details: data,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
