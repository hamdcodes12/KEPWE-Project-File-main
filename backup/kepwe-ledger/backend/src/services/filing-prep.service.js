import crypto from 'crypto';
import { pool } from '../config/db.js';
import * as gstEngine from './gst-engine.service.js';
import * as tdsEngine from './tds-engine.service.js';
import { integrationManager } from '../integrations/integration-manager.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mapFilingRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    returnType: row.return_type,
    taxPeriod: row.tax_period,
    preparedData: row.prepared_data || {},
    validationStatus: row.validation_status,
    validationErrors: Array.isArray(row.validation_errors) ? row.validation_errors : [],
    validationWarnings: [],
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    approvalNotes: row.approval_notes || '',
    submissionStatus: row.submission_status,
    submissionRef: row.submission_ref || null,
    submittedAt: row.submitted_at,
    providerResponse: row.provider_response || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createFilingDraft(companyId, userId, { returnType = 'GSTR-1', taxPeriod = '2026-09' }) {
  let preparedData = {};
  const validationErrors = [];
  const validationWarnings = [];

  if (returnType === 'GSTR-1') {
    preparedData = await gstEngine.prepareGstr1Data(companyId, taxPeriod);

    if (!preparedData.gstin || preparedData.gstin.length !== 15) {
      validationErrors.push('Company GSTIN is invalid or missing in company profile.');
    }
    if (preparedData.summary.totalInvoices === 0) {
      validationWarnings.push('No outward invoices found for this tax period.');
    }
    (preparedData.table12_hsn || []).forEach((h) => {
      if (!h.hsnCode || h.hsnCode.length < 4) {
        validationErrors.push(`HSN code ${h.hsnCode} is shorter than required 4 digits.`);
      }
    });
  } else if (returnType === 'GSTR-3B') {
    preparedData = await gstEngine.calculateGstr3b(companyId, taxPeriod);

    if (!preparedData.table31_outwardSupplies) {
      validationErrors.push('Unable to calculate Table 3.1 outward liabilities.');
    }
  } else if (returnType === 'TDS-26Q') {
    preparedData = await tdsEngine.prepareForm26q(companyId, taxPeriod);

    if (!preparedData.tan || preparedData.tan.length !== 10) {
      validationErrors.push('Company TAN is invalid or missing.');
    }
    if (preparedData.summary.balancePayable > 0) {
      validationWarnings.push(`Outstanding TDS of ₹${preparedData.summary.balancePayable} not yet deposited via Challan 281.`);
    }
  } else {
    throw new Error(`Unsupported return type: ${returnType}`);
  }

  const filingId = crypto.randomUUID();
  const validationStatus = validationErrors.length === 0 ? 'VALIDATED' : 'VALIDATION_ERRORS';

  const insertRes = await pool.query(
    `INSERT INTO filing_preparations
       (id, company_id, return_type, tax_period, prepared_data, validation_status,
        validation_errors, approval_status, submission_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_APPROVAL', 'NOT_SUBMITTED')
     RETURNING *`,
    [
      filingId,
      companyId,
      returnType,
      taxPeriod,
      JSON.stringify(preparedData),
      validationStatus,
      JSON.stringify(validationErrors)
    ]
  );

  return {
    ...mapFilingRow(insertRes.rows[0]),
    validationWarnings
  };
}

export async function approveFiling(companyId, filingId, userId, { approvedByRole = 'CA', notes = 'Approved after verification of books' }) {
  const currentRes = await pool.query(
    `SELECT * FROM filing_preparations WHERE id = $1 AND company_id = $2`,
    [filingId, companyId]
  );
  if (currentRes.rows.length === 0) throw new Error('Filing preparation record not found.');

  const filing = currentRes.rows[0];
  if (filing.validation_status === 'VALIDATION_ERRORS') {
    const errs = Array.isArray(filing.validation_errors) ? filing.validation_errors.join('; ') : 'Validation errors present';
    throw new Error(`Cannot approve filing with unresolved validation errors: ${errs}`);
  }

  const approvalStatus = approvedByRole === 'CA' ? 'APPROVED_BY_CA' : 'APPROVED_BY_USER';
  const approver = userId || (approvedByRole === 'CA' ? 'Authorized CA' : 'Authorized Approver');

  const updateRes = await pool.query(
    `UPDATE filing_preparations
     SET approval_status = $1, approved_at = NOW(), approval_notes = $2, submission_status = 'READY_FOR_PROVIDER', updated_at = NOW()
     WHERE id = $3 AND company_id = $4
     RETURNING *`,
    [approvalStatus, notes, filingId, companyId]
  );

  return { success: true, filing: mapFilingRow(updateRes.rows[0]) };
}

export async function submitFilingToProvider(companyId, filingId, userId) {
  const currentRes = await pool.query(
    `SELECT * FROM filing_preparations WHERE id = $1 AND company_id = $2`,
    [filingId, companyId]
  );
  if (currentRes.rows.length === 0) throw new Error('Filing preparation record not found.');

  const filing = mapFilingRow(currentRes.rows[0]);
  if (!filing.approvalStatus.startsWith('APPROVED')) {
    throw new Error('Filing must be approved by User or CA prior to provider submission.');
  }

  // Attempt real provider transmission via integration adapter
  const adapterKey = filing.returnType.startsWith('GST') ? 'GST' : 'TDS';
  const adapter = integrationManager.getAdapter(adapterKey);

  if (!adapter || !adapter.hasCredentials()) {
    return {
      success: false,
      filingId,
      status: 'CREDENTIALS_REQUIRED',
      providerKey: adapterKey,
      message: `${adapter?.providerName || adapterKey} credentials not configured. The return is validated, approved, and ready for submission once credentials are supplied in environment settings.`,
      requiredEnvVars: [
        `${adapterKey}_CLIENT_ID`,
        `${adapterKey}_CLIENT_SECRET`,
        `${adapterKey}_USERNAME`,
        `${adapterKey}_PASSWORD`
      ]
    };
  }

  try {
    const response = await adapter.send(`/returns/${filing.returnType.toLowerCase()}`, 'POST', {
      taxPeriod: filing.taxPeriod,
      payload: filing.preparedData
    });

    const genuineRef = response.arn || response.ackNo || response.referenceId || response.ackNumber;
    if (!genuineRef) {
      throw new Error('Government/Provider response did not contain an authentic ARN or acknowledgement reference number.');
    }

    const updateRes = await pool.query(
      `UPDATE filing_preparations
       SET submission_status = 'ACKNOWLEDGED', submission_ref = $1, submitted_at = NOW(), provider_response = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4
       RETURNING *`,
      [genuineRef, JSON.stringify(response), filingId, companyId]
    );

    return { success: true, filing: mapFilingRow(updateRes.rows[0]), response };
  } catch (err) {
    await pool.query(
      `UPDATE filing_preparations
       SET submission_status = 'FAILED', provider_response = $1, updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [JSON.stringify({ error: err.message }), filingId, companyId]
    );
    throw err;
  }
}

export async function getFilingPreparations(companyId) {
  const res = await pool.query(
    `SELECT * FROM filing_preparations WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  );
  return res.rows.map(mapFilingRow);
}
