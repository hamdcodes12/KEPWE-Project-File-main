import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireProductAccess } from '../middleware/product-auth.js';
import multer from 'multer';
import { pool, withRLSContext } from '../config/db.js';
import { processCreditReportPdf } from '../services/credit-report.service.js';

const router = Router();

// Enforce Credit product authorization on all endpoints
router.use(requireProductAccess('credit'));

const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
}).single('report');

function handleReportUpload(req, res, next) {
  reportUpload(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Report PDF must be 10 MB or smaller.' : 'Upload one PDF report file.',
    });
  });
}

router.get('/report', async (req, res, next) => {
  try {
    const result = await withRLSContext(req.userId, (client) => client.query(
      `SELECT id, original_filename, normalized_data, score_result, extraction_method, processed_at
       FROM credit_report_analyses WHERE user_id = $1`,
      [req.userId]
    ));
    if (!result.rows.length) return res.json({ report: null });
    const row = result.rows[0];
    return res.json({
      report: {
        id: row.id,
        fileName: row.original_filename,
        extractionMethod: row.extraction_method,
        processedAt: row.processed_at,
        normalizedData: row.normalized_data,
        score: row.score_result.score,
        warnings: row.score_result.warnings,
        recommendations: row.score_result.recommendations,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/report', handleReportUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a credit report PDF to upload.' });
    const analysis = await processCreditReportPdf(req.file.buffer);
    const fileName = (req.file.originalname || 'credit-report.pdf').replace(/[\\/\0-\x1f]/g, '_').slice(0, 255);
    const result = await withRLSContext(req.userId, (client) => client.query(
      `INSERT INTO credit_report_analyses
         (user_id, original_filename, report_pdf, normalized_data, score_result, extraction_method, processed_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         original_filename = EXCLUDED.original_filename,
         report_pdf = EXCLUDED.report_pdf,
         normalized_data = EXCLUDED.normalized_data,
         score_result = EXCLUDED.score_result,
         extraction_method = EXCLUDED.extraction_method,
         processed_at = NOW()
       RETURNING id, processed_at`,
      [req.userId, fileName, req.file.buffer, JSON.stringify(analysis.normalizedData), JSON.stringify(analysis), analysis.extractionMethod]
    ));
    return res.status(201).json({
      report: {
        id: result.rows[0].id,
        fileName,
        extractionMethod: analysis.extractionMethod,
        processedAt: result.rows[0].processed_at,
        ...analysis,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/report', async (req, res, next) => {
  try {
    await withRLSContext(req.userId, (client) => client.query(
      'DELETE FROM credit_report_analyses WHERE user_id = $1',
      [req.userId]
    ));
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});

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
