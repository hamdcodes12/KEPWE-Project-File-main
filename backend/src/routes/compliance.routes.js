import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { optionalAuth, validateBody } from '../middleware/auth.js';

const router = Router();

const complianceSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(255),
  cin: z.string().trim().max(21).optional().nullable(),
  gstin: z.string().trim().max(15).optional().nullable(),
  businessType: z.enum(['Private Limited', 'LLP', 'Partnership', 'Proprietorship', 'Other']).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  turnover: z.string().trim().max(20).optional().nullable(),
  employees: z.string().trim().max(20).optional().nullable(),
  name: z.string().trim().max(255).optional().nullable(),
  mobile: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
});

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/i;

/**
 * Deterministic compliance health scoring. Not a fixed constant — every
 * component is derived from the fields the visitor actually submitted, so
 * two different submissions produce two different, explainable scores.
 */
function computeComplianceScore(input) {
  const formalEntity = input.businessType === 'Private Limited' || input.businessType === 'LLP';
  const hasValidGstin = !!input.gstin && GSTIN_PATTERN.test(input.gstin.trim());
  const hasGstinPending = !!input.gstin && !hasValidGstin;
  const hasCin = !!input.cin && input.cin.trim().length > 0;
  const hasEmployees = !!input.employees && input.employees !== '0';
  const isPreRevenue = (input.turnover || '').toLowerCase().includes('pre-revenue');

  let score = 35;
  const recommendations = [];

  // GST
  let gstStatus;
  if (hasValidGstin) {
    gstStatus = 'Good';
    score += 20;
  } else if (hasGstinPending) {
    gstStatus = 'Attention';
    score += 10;
    recommendations.push('Verify and complete your GSTIN registration.');
  } else {
    gstStatus = isPreRevenue ? 'Good' : 'Action Required';
    if (!isPreRevenue) recommendations.push('Register for GST to avoid penalties on taxable turnover.');
    else score += 10;
  }

  // MCA (only applies to formal entities that require a CIN)
  let mcaStatus;
  if (!formalEntity) {
    mcaStatus = 'Good';
    score += 15;
  } else if (hasCin) {
    mcaStatus = 'Good';
    score += 20;
  } else {
    mcaStatus = 'Attention';
    score += 5;
    recommendations.push('Provide your CIN so we can verify MCA annual filing status.');
  }

  // TDS (proxy: formal entities with employees should be deducting/depositing TDS)
  let tdsStatus;
  if (formalEntity && hasEmployees) {
    tdsStatus = 'Good';
    score += 15;
  } else if (formalEntity) {
    tdsStatus = 'Attention';
    score += 8;
    recommendations.push('Confirm TDS deduction and deposit schedule for statutory payments.');
  } else {
    tdsStatus = 'Good';
    score += 10;
  }

  // Payroll
  let payrollStatus;
  if (hasEmployees) {
    payrollStatus = 'Good';
    score += 15;
  } else if (formalEntity) {
    payrollStatus = 'Action Required';
    recommendations.push('Set up payroll compliance (PF/ESI) once you have employees on record.');
  } else {
    payrollStatus = 'Good';
    score += 5;
  }

  // Data completeness bonus
  if (input.industry) score += 3;
  if (input.state) score += 2;

  score = Math.max(10, Math.min(100, Math.round(score)));

  const statuses = { gstStatus, tdsStatus, mcaStatus, payrollStatus };
  const issuesFound = Object.values(statuses).filter((s) => s !== 'Good').length;

  if (recommendations.length === 0) {
    recommendations.push('Your business fundamentals look healthy — schedule a review to optimize further.');
  }

  return { score, ...statuses, issuesFound, recommendations };
}

/**
 * POST /api/compliance-check
 * Free Compliance Check wizard submission. Persists the company/contact
 * data and the computed health score to PostgreSQL, and creates a linked
 * CRM lead (mirrors the previous client-only addCRMLead() call).
 */
router.post('/compliance-check', optionalAuth, validateBody(complianceSchema), async (req, res, next) => {
  try {
    const b = req.validatedBody;
    const createdBy = req.userId || null;
    const result = computeComplianceScore(b);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let leadId = null;
      if (b.name && b.mobile && b.email) {
        const leadInsert = await client.query(
          `INSERT INTO crm_leads
             (company_name, contact_name, mobile, email, cin, gstin, industry, state,
              gst_status, lead_score, lead_source, incorporation_date, created_by, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active','HOT','Free Compliance Check Form', CURRENT_DATE, $9, 'New')
           RETURNING id`,
          [
            b.companyName,
            b.name,
            b.mobile,
            b.email,
            b.cin || null,
            b.gstin || null,
            b.industry || null,
            b.state || null,
            createdBy,
          ]
        );
        leadId = leadInsert.rows[0].id;

        await client.query(
          `INSERT INTO lead_activities (lead_id, activity, performed_by) VALUES ($1, $2, $3)`,
          [leadId, 'Free Compliance Report Generated', createdBy]
        );
      }

      const checkInsert = await client.query(
        `INSERT INTO compliance_checks
           (user_id, lead_id, company_name, cin, gstin, business_type, industry, state,
            avg_monthly_turnover, contact_name, contact_mobile, contact_email,
            overall_score, gst_status, tds_status, mca_status, payroll_status,
            issues_found, recommendations, report_generated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
         RETURNING id, created_at`,
        [
          createdBy,
          leadId,
          b.companyName,
          b.cin || null,
          b.gstin || null,
          b.businessType || null,
          b.industry || null,
          b.state || null,
          b.turnover || null,
          b.name || null,
          b.mobile || null,
          b.email || null,
          result.score,
          result.gstStatus,
          result.tdsStatus,
          result.mcaStatus,
          result.payrollStatus,
          result.issuesFound,
          JSON.stringify(result.recommendations),
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        id: checkInsert.rows[0].id,
        overallScore: result.score,
        gstStatus: result.gstStatus,
        tdsStatus: result.tdsStatus,
        mcaStatus: result.mcaStatus,
        payrollStatus: result.payrollStatus,
        issuesFound: result.issuesFound,
        recommendations: result.recommendations,
        leadId,
        createdAt: checkInsert.rows[0].created_at,
      });
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

export default router;
