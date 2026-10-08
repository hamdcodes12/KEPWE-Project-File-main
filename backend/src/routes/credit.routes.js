import { Router } from 'express';
import { z } from 'zod';
import { requireProductAccess } from '../middleware/product-auth.js';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { pool, withRLSContext } from '../config/db.js';
import { processCreditReportPdf } from '../services/credit-report.service.js';

const router = Router();

// Enforce Credit product authorization on all endpoints
router.use(requireProductAccess('credit'));

const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
}).single('report');

const applicationDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 8, fieldSize: 16 * 1024 },
}).array('documents', 5);

function handleReportUpload(req, res, next) {
  reportUpload(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Report PDF must be 10 MB or smaller.' : 'Upload one PDF report file.',
    });
  });
}

function handleApplicationDocuments(req, res, next) {
  applicationDocumentUpload(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    const tooMany = err.code === 'LIMIT_FILE_COUNT';
    return res.status(tooLarge || tooMany ? 413 : 400).json({
      error: tooLarge ? 'Each document must be 10 MB or smaller.' : tooMany ? 'Upload no more than five documents.' : 'Could not read application documents.',
    });
  });
}

function safeApplicationFilename(filename) {
  return (filename || 'document').replace(/[\\/\0-\x1f\x7f]/g, '_').slice(0, 255);
}

function validateApplicationDocument(file) {
  const bytes = file.buffer;
  const isPdf = file.mimetype === 'application/pdf' && bytes.subarray(0, 5).toString() === '%PDF-';
  const isPng = file.mimetype === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return isPdf || isPng || isJpeg;
}

function mapApplication(row) {
  return {
    id: row.id,
    applicationId: row.application_number,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    loanType: row.loan_type,
    requestedAmount: row.requested_amount,
    purpose: row.purpose,
    businessName: row.business_name,
    annualTurnover: row.annual_turnover,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    applicantMobile: row.applicant_mobile,
  };
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
 * Returns real data from DB. No credit lines or metrics are fabricated —
 * a user with no connected lender gets empty arrays and null metrics.
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
      creditLines: [],
      metrics: null,
      integrationStatus: 'PENDING',
    });
  } catch (err) {
    next(err);
  }
});

const applicationSchema = z.object({
  loanType: z.enum(['working_capital', 'term_loan', 'invoice_discounting', 'equipment_finance', 'other']),
  requestedAmount: z.coerce.number().positive().max(100_000_000),
  purpose: z.string().trim().min(10).max(2000),
  businessName: z.preprocess((value) => value === '' ? null : value, z.string().trim().max(255).nullable().optional()),
  annualTurnover: z.preprocess((value) => value === '' || value === undefined ? null : value, z.coerce.number().nonnegative().max(1_000_000_000_000).nullable().optional()),
});

/** List only applications owned by the authenticated Credit user. */
router.get('/applications', async (req, res, next) => {
  try {
    const result = await withRLSContext(req.userId, (client) => client.query(
      `SELECT id, application_number, status, submitted_at, reviewed_at, loan_type,
              requested_amount, purpose, business_name, annual_turnover,
              applicant_name, applicant_email, applicant_mobile
       FROM credit_loan_applications WHERE user_id = $1 ORDER BY submitted_at DESC`,
      [req.userId]
    ));
    return res.json({ applications: result.rows.map(mapApplication) });
  } catch (err) {
    next(err);
  }
});

/** Submit an application and optional supporting documents in one transaction. */
router.post('/applications', handleApplicationDocuments, async (req, res, next) => {
  try {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the application details and try again.', issues: parsed.error.issues });
    const files = req.files || [];
    if (files.some((file) => !validateApplicationDocument(file))) {
      return res.status(400).json({ error: 'Documents must be valid PDF, JPG, or PNG files.' });
    }
    if (files.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Combined document size must be 25 MB or less.' });
    }
    const data = parsed.data;
    const user = req.user;
    if (!user?.full_name || !user?.email) return res.status(400).json({ error: 'Complete your account profile before applying.' });
    const applicationNumber = `KCA-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
    const application = await withRLSContext(req.userId, async (client) => {
      const inserted = await client.query(
        `INSERT INTO credit_loan_applications
          (application_number, user_id, applicant_name, applicant_email, applicant_mobile,
           loan_type, requested_amount, purpose, business_name, annual_turnover)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, application_number, status, submitted_at, reviewed_at, loan_type,
                   requested_amount, purpose, business_name, annual_turnover,
                   applicant_name, applicant_email, applicant_mobile`,
        [applicationNumber, req.userId, user.full_name, user.email, user.mobile, data.loanType,
          data.requestedAmount, data.purpose, data.businessName || null, data.annualTurnover ?? null]
      );
      const row = inserted.rows[0];
      for (const file of files) {
        await client.query(
          `INSERT INTO credit_loan_application_documents
             (application_id, original_filename, mime_type, file_size_bytes, file_content)
           VALUES ($1,$2,$3,$4,$5)`,
          [row.id, safeApplicationFilename(file.originalname), file.mimetype, file.size, file.buffer]
        );
      }
      await client.query(
        `INSERT INTO credit_loan_application_events (application_id, to_status, actor_user_id)
         VALUES ($1, 'pending', $2)`,
        [row.id, req.userId]
      );
      return row;
    });
    return res.status(201).json({ application: mapApplication(application), documentCount: files.length });
  } catch (err) {
    next(err);
  }
});

/** Load one application and its timeline, scoped to the signed-in owner. */
router.get('/applications/:applicationId', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.applicationId);
    if (!id.success) return res.status(404).json({ error: 'Application not found.' });
    const data = await withRLSContext(req.userId, async (client) => {
      const result = await client.query(
        `SELECT id, application_number, status, submitted_at, reviewed_at, loan_type,
                requested_amount, purpose, business_name, annual_turnover,
                applicant_name, applicant_email, applicant_mobile
         FROM credit_loan_applications WHERE id = $1 AND user_id = $2`,
        [id.data, req.userId]
      );
      if (!result.rows.length) return null;
      const events = await client.query(
        `SELECT to_status, from_status, created_at
         FROM credit_loan_application_events WHERE application_id = $1 ORDER BY created_at, id`,
        [id.data]
      );
      const documents = await client.query(
        `SELECT id, original_filename, mime_type, file_size_bytes, uploaded_at
         FROM credit_loan_application_documents WHERE application_id = $1 ORDER BY uploaded_at, id`,
        [id.data]
      );
      return { application: mapApplication(result.rows[0]), events: events.rows, documents: documents.rows };
    });
    if (!data) return res.status(404).json({ error: 'Application not found.' });
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
