import crypto from 'crypto';
import { pool } from '../config/db.js';
import * as accountingEngine from './accounting-engine.service.js';
import { roundMoney } from './accounting-engine.service.js';
import { formatDateOnly } from '../lib/date-utils.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mapAssetRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    assetCode: row.asset_code,
    name: row.name,
    category: row.category,
    purchaseDate: formatDateOnly(row.purchase_date),
    purchaseCost: Number(row.purchase_cost || 0),
    salvageValue: Number(row.salvage_value || 0),
    usefulLifeYears: Number(row.useful_life_years || 5),
    depreciationMethod: row.depreciation_method,
    depreciationRate: Number(row.depreciation_rate || 0),
    accumulatedDepreciation: Number(row.accumulated_depr || 0),
    netBookValue: Number(row.net_book_value || 0),
    status: row.status || 'ACTIVE',
    disposalDate: row.disposal_date ? formatDateOnly(row.disposal_date) : null,
    disposalProceeds: Number(row.disposal_proceeds || 0),
    gainLossOnDisposal: Number(row.gain_loss_on_disposal || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createFixedAsset(companyId, userId, data) {
  const name = data.name?.trim();
  const cost = roundMoney(data.purchaseCost);
  if (!name || cost <= 0) throw new Error('Asset name and positive purchase cost are required.');

  const countRes = await pool.query(
    `SELECT COUNT(*) as count FROM fixed_assets WHERE company_id = $1`,
    [companyId]
  );
  const nextNum = String(Number(countRes.rows[0]?.count || 0) + 1).padStart(3, '0');
  const assetCode = data.assetCode?.trim() || `AST-${nextNum}`;

  const purchaseDate = data.purchaseDate || new Date().toISOString().split('T')[0];
  const salvageValue = roundMoney(data.salvageValue || 0);
  const usefulLifeYears = Number(data.usefulLifeYears) || 5;
  const method = data.depreciationMethod === 'WDV' ? 'WDV' : 'SLM';

  let depreciationRate = 0;
  if (method === 'SLM') {
    depreciationRate = roundMoney(((cost - salvageValue) / usefulLifeYears / cost) * 100);
  } else {
    depreciationRate = Number(data.depreciationRate) || (data.category?.includes('Computer') ? 40.0 : 15.0);
  }

  const assetId = crypto.randomUUID();

  // If purchase journal requested, post capital expenditure entry:
  // Debit: 1061 Fixed Asset
  // Credit: 1010 Bank / Accounts Payable
  let purchaseJournalId = null;
  if (data.recordPurchaseJournal) {
    const coa = await accountingEngine.getChartOfAccounts(companyId);
    const assetAcc = coa.find((a) => a.code === '1061') || coa.find((a) => a.subtype === 'FIXED_ASSET');
    const bankAcc = coa.find((a) => a.code === '1010') || coa.find((a) => a.subtype === 'BANK');

    if (assetAcc && bankAcc) {
      const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
        entryDate: purchaseDate,
        narration: `Capital Expenditure: Purchase of ${name} (${assetCode})`,
        referenceType: 'MANUAL',
        referenceId: assetId,
        referenceNumber: assetCode,
        lines: [
          { accountId: assetAcc.id, debit: cost, credit: 0, narration: `Fixed Asset Acquisition: ${name}` },
          { accountId: bankAcc.id, debit: 0, credit: cost, narration: `Payment for ${name}` }
        ]
      });
      purchaseJournalId = journalEntry.id;
    }
  }

  const insertRes = await pool.query(
    `INSERT INTO fixed_assets
       (id, company_id, asset_code, name, category, purchase_date, purchase_cost,
        salvage_value, useful_life_years, depreciation_method, depreciation_rate,
        accumulated_depr, net_book_value, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0.00, $7, 'ACTIVE')
     RETURNING *`,
    [
      assetId,
      companyId,
      assetCode,
      name,
      data.category || 'Computers & IT',
      purchaseDate,
      cost,
      salvageValue,
      usefulLifeYears,
      method,
      depreciationRate
    ]
  );

  return mapAssetRow(insertRes.rows[0]);
}

export async function getFixedAssets(companyId) {
  const res = await pool.query(
    `SELECT * FROM fixed_assets WHERE company_id = $1 ORDER BY asset_code ASC`,
    [companyId]
  );
  return res.rows.map(mapAssetRow);
}

export async function executeDepreciationRun(companyId, userId, { period = 'FY-2026-27', monthsCount = 12 }) {
  const assets = await getFixedAssets(companyId);
  const activeAssets = assets.filter((a) => a.status === 'ACTIVE' && a.netBookValue > a.salvageValue);

  if (activeAssets.length === 0) {
    throw new Error('No active depreciable assets available.');
  }

  let totalDepreciation = 0;
  const assetCalculations = [];

  for (const asset of activeAssets) {
    let deprAmount = 0;
    if (asset.depreciationMethod === 'SLM') {
      const annualDepr = (asset.purchaseCost - asset.salvageValue) / asset.usefulLifeYears;
      deprAmount = roundMoney((annualDepr * monthsCount) / 12);
    } else {
      // WDV
      const annualDepr = (asset.netBookValue * asset.depreciationRate) / 100;
      deprAmount = roundMoney((annualDepr * monthsCount) / 12);
    }

    const maxDepr = roundMoney(Math.max(0, asset.netBookValue - asset.salvageValue));
    deprAmount = Math.min(deprAmount, maxDepr);

    if (deprAmount > 0) {
      const newAccum = roundMoney(asset.accumulatedDepreciation + deprAmount);
      const newNet = roundMoney(asset.purchaseCost - newAccum);
      totalDepreciation = roundMoney(totalDepreciation + deprAmount);

      assetCalculations.push({
        assetId: asset.id,
        assetCode: asset.assetCode,
        name: asset.name,
        depreciationAmount: deprAmount,
        closingBookValue: newNet,
        newAccumulatedDepr: newAccum
      });
    }
  }

  if (totalDepreciation <= 0) {
    throw new Error('All assets are fully depreciated to salvage value.');
  }

  // ── Post Balanced Double-Entry Depreciation Journal ───────────────────────
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const deprExpenseAcc = coa.find((a) => a.code === '5080') || coa.find((a) => a.subtype === 'DEPRECIATION_EXPENSE');
  const accumDeprAcc = coa.find((a) => a.code === '1090') || coa.find((a) => a.subtype === 'ACCUM_DEPRECIATION');

  if (!deprExpenseAcc || !accumDeprAcc) {
    throw new Error('Required Depreciation Expense or Accumulated Depreciation accounts not found in Chart of Accounts.');
  }

  const runId = crypto.randomUUID();
  const runDate = new Date().toISOString().split('T')[0];

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: runDate,
    narration: `Fixed Asset Depreciation Run for ${period} (${activeAssets.length} assets)`,
    referenceType: 'DEPRECIATION',
    referenceId: runId,
    referenceNumber: `DEPR-${period}`,
    lines: [
      { accountId: deprExpenseAcc.id, debit: totalDepreciation, credit: 0, narration: `Depreciation Expense for ${period}` },
      { accountId: accumDeprAcc.id, debit: 0, credit: totalDepreciation, narration: `Accumulated Depreciation for ${period}` }
    ]
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const calc of assetCalculations) {
      // Record depreciation entry
      await client.query(
        `INSERT INTO fixed_asset_depreciations
           (id, asset_id, company_id, period_start, period_end, depreciation_amount, closing_book_value, journal_entry_id)
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          calc.assetId,
          companyId,
          calc.depreciationAmount,
          calc.closingBookValue,
          journalEntry.id
        ]
      );

      // Update asset master
      await client.query(
        `UPDATE fixed_assets
         SET accumulated_depr = $1, net_book_value = $2, updated_at = NOW()
         WHERE id = $3 AND company_id = $4`,
        [calc.newAccumulatedDepr, calc.closingBookValue, calc.assetId, companyId]
      );
    }

    await client.query('COMMIT');

    const runObj = {
      id: runId,
      companyId,
      period,
      runDate,
      totalAssets: activeAssets.length,
      totalDepreciation,
      journalEntryId: journalEntry.id,
      assetBreakdown: assetCalculations,
      createdAt: new Date().toISOString()
    };

    return { run: runObj, journalEntry };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDepreciationRuns(companyId) {
  const res = await pool.query(
    `SELECT d.*, a.name as asset_name, a.asset_code, j.entry_number as journal_entry_number
     FROM fixed_asset_depreciations d
     JOIN fixed_assets a ON d.asset_id = a.id
     LEFT JOIN journal_entries j ON d.journal_entry_id = j.id
     WHERE d.company_id = $1
     ORDER BY d.created_at DESC`,
    [companyId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    assetCode: row.asset_code,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    depreciationAmount: Number(row.depreciation_amount || 0),
    closingBookValue: Number(row.closing_book_value || 0),
    journalEntryId: row.journal_entry_id,
    journalEntryNumber: row.journal_entry_number,
    createdAt: row.created_at
  }));
}
