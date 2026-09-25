import { BaseProviderAdapter } from './base-provider-adapter.js';

/**
 * GstProviderAdapter
 * Production-ready integration adapter for GSTN (Goods and Services Tax Network)
 * via authorized GSP (GST Suvidha Provider) APIs.
 * 
 * Implements standard GSTN v0.3 specifications for:
 * - GSP Authentication & Token Lifecycle
 * - GSTR-1 Inward/Outward Return Save & File (Form Tables 4, 5, 7, 9B, 12, 13)
 * - GSTR-3B Tax Offset & Statutory Summary File (Rule 88A)
 * - GSTR-2B Inward Supplies Auto-Drafted Feed Download
 * - ARN (Application Reference Number) Status Polling
 */
export class GstProviderAdapter extends BaseProviderAdapter {
  constructor(options = {}) {
    super('GST', 'GSTN Government System (GSP API)', {
      baseUrl: options.baseUrl || process.env.GST_BASE_URL || 'https://api.gsp.nic.in/taxpayerapi/v0.3',
      ...options
    });
    this.gstin = options.gstin || process.env.GSTIN || '';
    this.stateCode = options.stateCode || process.env.GST_STATE_CODE || '27';
  }

  /**
   * Checks if required GSP and taxpayer credentials are provided
   */
  hasCredentials() {
    return Boolean(this.clientId && this.clientSecret && this.username && this.password);
  }

  /**
   * Health check verifying GSP credentials and connection readiness
   */
  async healthCheck() {
    if (!this.hasCredentials()) {
      return {
        providerKey: this.providerKey,
        providerName: this.providerName,
        connected: false,
        status: 'CREDENTIALS_REQUIRED',
        environment: this.environment,
        message: 'GSTN GSP credentials required. Please configure GST_CLIENT_ID, GST_CLIENT_SECRET, GST_USERNAME, and GST_PASSWORD.',
        requiredEnvVars: [
          'GST_CLIENT_ID',
          'GST_CLIENT_SECRET',
          'GST_USERNAME',
          'GST_PASSWORD',
          'GSTIN',
          'GST_STATE_CODE',
          'GST_ENV'
        ]
      };
    }

    try {
      await this.ensureAuthenticated();
      return {
        providerKey: this.providerKey,
        providerName: this.providerName,
        connected: true,
        status: 'CONNECTED',
        environment: this.environment,
        message: 'Successfully connected to GSTN via GSP gateway.',
        tokenValid: Boolean(this.authToken)
      };
    } catch (err) {
      return {
        providerKey: this.providerKey,
        providerName: this.providerName,
        connected: false,
        status: 'AUTH_FAILED',
        environment: this.environment,
        message: err.message
      };
    }
  }

  /**
   * Authenticates with GSP gateway to obtain taxpayer session auth token
   */
  async authenticate() {
    if (!this.hasCredentials()) {
      throw new Error(`Cannot authenticate with GSTN GSP: credentials not configured. Set GST_CLIENT_ID and GST_CLIENT_SECRET.`);
    }

    const response = await this.send('/authenticate', 'POST', {
      action: 'ACCESSTOKEN',
      username: this.username,
      password: this.password
    }, {
      'client_id': this.clientId,
      'client_secret': this.clientSecret,
      'state-cd': this.stateCode,
      'txn': `TXN-${Date.now()}`
    });

    this.authToken = response.auth_token || response.token;
    this.tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;
    return response;
  }

  /**
   * Saves GSTR-1 payload to GSTN portal
   */
  async saveGstr1(taxPeriod, gstr1Data) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'GST GSP credentials not configured. Please supply GST_CLIENT_ID, GST_CLIENT_SECRET, and GST_USERNAME.'
      };
    }

    await this.ensureAuthenticated();
    const payload = this.formatGstr1Payload(taxPeriod, gstr1Data);
    const response = await this.send('/returns/gstr1', 'POST', {
      action: 'RETSAVE',
      data: payload
    }, {
      'gstin': this.gstin || gstr1Data.gstin,
      'ret_period': taxPeriod.replace('-', '')
    });

    return {
      success: true,
      status: 'SAVED',
      referenceId: response.reference_id || response.ref_id,
      rawResponse: response
    };
  }

  /**
   * Files GSTR-1 return with DSC / EVC signature
   */
  async fileGstr1(taxPeriod, gstr1Data, signature = null) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'GST GSP credentials not configured.'
      };
    }

    await this.ensureAuthenticated();
    const response = await this.send('/returns/gstr1', 'POST', {
      action: 'RETFILE',
      data: gstr1Data,
      sign: signature
    }, {
      'gstin': this.gstin || gstr1Data.gstin,
      'ret_period': taxPeriod.replace('-', '')
    });

    if (!response.arn) {
      throw new Error('GSTN did not return an Application Reference Number (ARN) for GSTR-1 filing.');
    }

    return {
      success: true,
      status: 'FILED',
      arn: response.arn,
      ackNumber: response.arn,
      filingDate: response.filing_date || new Date().toISOString(),
      rawResponse: response
    };
  }

  /**
   * Saves & Files GSTR-3B return to GSTN portal
   */
  async fileGstr3b(taxPeriod, gstr3bData, signature = null) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'GST GSP credentials not configured.'
      };
    }

    await this.ensureAuthenticated();
    const response = await this.send('/returns/gstr3b', 'POST', {
      action: 'RETFILE',
      data: gstr3bData,
      sign: signature
    }, {
      'gstin': this.gstin || gstr3bData.gstin,
      'ret_period': taxPeriod.replace('-', '')
    });

    if (!response.arn) {
      throw new Error('GSTN did not return an Application Reference Number (ARN) for GSTR-3B filing.');
    }

    return {
      success: true,
      status: 'FILED',
      arn: response.arn,
      ackNumber: response.arn,
      filingDate: response.filing_date || new Date().toISOString(),
      rawResponse: response
    };
  }

  /**
   * Downloads official auto-drafted GSTR-2B inward supplies from GSTN
   */
  async downloadGstr2b(taxPeriod, gstin = null) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'GST GSP credentials not configured.'
      };
    }

    await this.ensureAuthenticated();
    const targetGstin = gstin || this.gstin;
    const formattedPeriod = taxPeriod.replace('-', ''); // MMYYYY or YYYYMM format

    const response = await this.send(`/returns/gstr2b?action=B2B&rtn_prd=${formattedPeriod}&gstin=${targetGstin}`, 'GET');
    
    // Normalize inward documents from GSTN 2B schema
    const b2bInvoices = (response.data?.b2b || []).flatMap((invGroup) => {
      const counterpartyGstin = invGroup.ctin;
      const counterpartyName = invGroup.tradeName || 'Vendor';
      return (invGroup.inv || []).map((inv) => ({
        id: inv.inum,
        documentNumber: inv.inum,
        documentDate: inv.idt?.split('-').reverse().join('-') || inv.idt,
        counterpartyName,
        counterpartyGstin,
        taxableValue: inv.val,
        taxAmount: (inv.items || []).reduce((acc, it) => acc + (it.camt || 0) + (it.samt || 0) + (it.iamt || 0), 0),
        totalAmount: inv.val
      }));
    });

    return {
      success: true,
      count: b2bInvoices.length,
      records: b2bInvoices,
      rawResponse: response
    };
  }

  /**
   * Tracks filing status using GSTN ARN
   */
  async getFilingStatus(arn) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'GST GSP credentials not configured.'
      };
    }

    await this.ensureAuthenticated();
    return this.send(`/returns?action=RETSTATUS&arn=${arn}&gstin=${this.gstin}`, 'GET');
  }

  /**
   * Normalizes internal GSTR-1 data to GSTN JSON payload schema
   */
  formatGstr1Payload(taxPeriod, data) {
    return {
      gstin: data.gstin || this.gstin,
      fp: taxPeriod.replace('-', ''),
      b2b: (data.table4_b2b || []).map((inv) => ({
        ctin: inv.customerGstin,
        cfs: 'Y',
        inv: [{
          inum: inv.invoiceNumber,
          idt: inv.invoiceDate?.split('-').reverse().join('-'),
          val: inv.totalAmount,
          pos: inv.placeOfSupplyCode,
          rchrg: inv.reverseCharge ? 'Y' : 'N',
          inv_typ: 'R',
          itms: (inv.items || []).map((item, idx) => ({
            num: idx + 1,
            itm_det: {
              txval: item.taxableValue,
              rt: item.gstRate,
              iamt: item.igstAmount,
              camt: item.cgstAmount,
              samt: item.sgstAmount,
              csamt: 0.0
            }
          }))
        }]
      })),
      b2cl: data.table5_b2cLarge || [],
      b2cs: data.table7_b2cSmall || [],
      cdnr: data.table9b_cdn || [],
      hsn: {
        data: (data.table12_hsn || []).map((h, idx) => ({
          num: idx + 1,
          hsn_sc: h.hsnCode,
          desc: h.description,
          uqc: h.unit || 'NOS',
          qty: h.totalQuantity,
          val: h.totalTaxable,
          txval: h.totalTaxable,
          iamt: h.igstAmount,
          camt: h.cgstAmount,
          samt: h.sgstAmount,
          csamt: 0.0
        }))
      },
      doc_issue: data.table13_documents || {}
    };
  }
}
