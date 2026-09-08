import { BaseProviderAdapter } from './base-provider-adapter.js';



export class TdsProviderAdapter extends BaseProviderAdapter {
  constructor(options = {}) {
    super('TDS', 'NSDL / TRACES Tax Portal', {
      baseUrl: options.baseUrl || process.env.TDS_BASE_URL || 'https://traces.gov.in/api/v1',
      ...options
    });
    this.tan = options.tan || process.env.TRACES_TAN || '';
  }

  /**
   * Checks if required TRACES credentials are configured
   */
  hasCredentials() {
    return Boolean(this.username && this.password && (this.tan || process.env.TRACES_TAN));
  }

  /**
   * Health check verifying TRACES credentials and gateway connectivity
   */
  async healthCheck() {
    if (!this.hasCredentials()) {
      return {
        providerKey: this.providerKey,
        providerName: this.providerName,
        connected: false,
        status: 'CREDENTIALS_REQUIRED',
        environment: this.environment,
        message: 'TRACES / NSDL credentials required. Please configure TRACES_USER_ID, TRACES_PASSWORD, and TRACES_TAN in environment.',
        requiredEnvVars: [
          'TRACES_USER_ID',
          'TRACES_PASSWORD',
          'TRACES_TAN',
          'TDS_CLIENT_ID',
          'TDS_CLIENT_SECRET',
          'TDS_ENV'
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
        message: 'Successfully connected to TRACES / NSDL e-TDS system.',
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
   * Authenticates with TRACES API
   */
  async authenticate() {
    if (!this.hasCredentials()) {
      throw new Error('Cannot authenticate with TRACES: credentials not configured. Please supply TRACES_USER_ID, TRACES_PASSWORD, and TRACES_TAN.');
    }

    const response = await this.send('/auth/login', 'POST', {
      tan: this.tan || process.env.TRACES_TAN,
      userId: this.username || process.env.TRACES_USER_ID,
      password: this.password || process.env.TRACES_PASSWORD
    });

    this.authToken = response.sessionToken || response.token;
    this.tokenExpiresAt = Date.now() + (response.expiresInSeconds || 1800) * 1000;
    return response;
  }

  /**
   * Verifies an ITNS 281 Challan with NSDL/TIN database
   */
  async verifyChallan(challanData) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'TRACES credentials not configured. Cannot verify Challan.'
      };
    }

    await this.ensureAuthenticated();
    const response = await this.send('/challan/verify', 'POST', {
      tan: this.tan || challanData.tan,
      bsrCode: challanData.bsrCode,
      depositDate: challanData.depositDate,
      challanSerial: challanData.challanSerial || challanData.challanNumber,
      amount: challanData.amount || challanData.taxAmount
    });

    return {
      success: true,
      status: response.status || 'VERIFIED',
      cin: response.cin,
      claimedAmount: response.claimedAmount,
      availableBalance: response.availableBalance,
      isMatched: response.isMatched,
      rawResponse: response
    };
  }

  /**
   * Submits Form 26Q quarterly TDS return package
   */
  async submitForm26q(quarter, returnData, dscSignature = null) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'TRACES credentials not configured.'
      };
    }

    await this.ensureAuthenticated();
    const eTdsFileContent = this.generateFvuText(returnData);
    const response = await this.send('/returns/upload', 'POST', {
      formType: '26Q',
      quarter,
      financialYear: returnData.financialYear || '2026-27',
      tan: this.tan || returnData.tan,
      fvuContent: Buffer.from(eTdsFileContent).toString('base64'),
      signature: dscSignature
    });

    if (!response.prn && !response.provisionalReceiptNumber && !response.tokenNumber) {
      throw new Error('TRACES did not return a Provisional Receipt Number (PRN) for Form 26Q.');
    }

    return {
      success: true,
      status: 'SUBMITTED',
      prn: response.prn || response.provisionalReceiptNumber || response.tokenNumber,
      referenceNumber: response.prn || response.tokenNumber,
      submittedAt: new Date().toISOString(),
      rawResponse: response
    };
  }

  /**
   * Requests Form 16A TDS certificates generation
   */
  async requestForm16a(quarter, financialYear) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'TRACES credentials not configured.'
      };
    }

    await this.ensureAuthenticated();
    const response = await this.send('/certificates/form16a/request', 'POST', {
      tan: this.tan,
      quarter,
      financialYear
    });

    return {
      success: true,
      requestId: response.requestId,
      status: response.status || 'REQUESTED',
      rawResponse: response
    };
  }

  /**
   * Compiles statutory NSDL FVU ASCII fixed-width / delimiter format for Form 26Q
   */
  generateFvuText(data) {
    const lines = [];
    // File Header Record (FH)
    lines.push(`FH^SL1^26Q^${new Date().toISOString().slice(0, 10).replace(/-/g, '')}^${data.tan || this.tan}^1^`);
    // Batch Header Record (BH)
    lines.push(`BH^1^${data.tan}^${data.pan || ''}^${data.companyName || 'KEPWE'}^202627^${data.quarter || 'Q2'}^`);
    // Challan Details Records (CD)
    (data.challans || []).forEach((c, idx) => {
      lines.push(`CD^${idx + 1}^${c.sectionCode}^${c.taxAmount}^0^0^${c.totalPaid}^${c.bsrCode}^${c.challanDate.replace(/-/g, '')}^${c.challanSerial}^`);
    });
    // Deductee Details Records (DD)
    (data.deducteeRecords || []).forEach((d, idx) => {
      lines.push(`DD^${idx + 1}^${d.section}^${d.pan || 'PANNOTAVBL'}^${d.deducteeName}^${d.grossAmount}^${d.tdsRate}^${d.tdsAmount}^${d.paymentDate.replace(/-/g, '')}^`);
    });
    return lines.join('\r\n');
  }
}
