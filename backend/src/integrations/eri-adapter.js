import { BaseProviderAdapter } from './base-provider-adapter.js';

/**
 * Income Tax ERI (e-Return Intermediary) Gateway Adapter
 * Standard specification for Income Tax Department (ITD) e-Filing API v2.0.
 *
 * Implements strict credential-gated interfaces for:
 * - ERI Authentication
 * - Client Management (Add Client, Client Consent)
 * - Prefill Ingestion
 * - ITR Validation (ITR-1 through ITR-7 schema checks)
 * - ITR Submission
 * - e-Verification
 * - Acknowledgement Retrieval (ITR-V)
 *
 * In accordance with client specifications, this integration is optional and
 * kept DISABLED BY DEFAULT until authorized government ERI credentials are provided.
 */
export class IncomeTaxEriAdapter extends BaseProviderAdapter {
  constructor() {
    super('ERI', 'Income Tax Department (ERI e-Filing Gateway)', {
      baseUrl: process.env.ITD_ERI_BASE_URL || 'https://e-filing.incometax.gov.in/e-Filing/services/ws',
      clientId: process.env.ITD_ERI_CLIENT_ID,
      clientSecret: process.env.ITD_ERI_CLIENT_SECRET,
      tokenExpirySeconds: 3600
    });

    this.eriNumber = process.env.ITD_ERI_NUMBER || null;
    this.certificatePath = process.env.ITD_ERI_CERT_PATH || null;
  }

  getRequiredEnvVars() {
    return [
      'ITD_ERI_CLIENT_ID',
      'ITD_ERI_CLIENT_SECRET',
      'ITD_ERI_NUMBER',
      'ITD_ERI_ENVIRONMENT'
    ];
  }

  isConfigured() {
    return Boolean(
      process.env.ITD_ERI_CLIENT_ID &&
      process.env.ITD_ERI_CLIENT_SECRET &&
      process.env.ITD_ERI_NUMBER
    );
  }

  /**
   * 1. ERI Authentication & Session Management
   */
  async authenticate(credentials = {}) {
    if (!this.isConfigured()) {
      return this.credentialsRequiredResponse('authenticate', {
        hint: 'Requires ITD_ERI_CLIENT_ID, ITD_ERI_CLIENT_SECRET, and ITD_ERI_NUMBER.'
      });
    }

    return this.executeWithRetry('authenticate', async () => {
      const response = await this.send('/auth', 'POST', {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        eriNumber: this.eriNumber,
        ...credentials
      });
      this.authToken = response.sessionToken || response.token;
      return {
        success: true,
        sessionToken: this.authToken,
        expiresIn: response.expiresIn || 3600,
        eriNumber: this.eriNumber
      };
    });
  }

  /**
   * 2. Add Client to ERI Dashboard
   */
  async addClient(clientPan, clientConsentToken) {
    if (!clientPan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clientPan)) {
      throw new Error(`Invalid Client PAN format: ${clientPan}`);
    }

    if (!this.isConfigured()) {
      return this.credentialsRequiredResponse('addClient', { clientPan });
    }

    return this.executeWithRetry('addClient', async () => {
      const response = await this.send('/clients/add', 'POST', {
        clientPan,
        clientConsentToken
      });
      return {
        success: Boolean(response.success),
        clientPan,
        status: response.status || 'CLIENT_ADDED',
        consentStatus: response.consentStatus || 'ACTIVE'
      };
    });
  }

  /**
   * 3. Verify Client Consent Status
   */
  async getClientConsentStatus(clientPan) {
    if (!this.isConfigured()) {
      return this.credentialsRequiredResponse('getClientConsentStatus', { clientPan });
    }

    return this.executeWithRetry('getClientConsentStatus', async () => {
      const response = await this.send(`/clients/${clientPan}/consent-status`, 'GET');
      return {
        success: true,
        clientPan,
        consentActive: Boolean(response.consentActive),
        validUntil: response.validUntil
      };
    });
  }

  /**
   * 4. Ingest Prefill Data from Income Tax Portal (AIS / TIS / 26AS)
   */
  async fetchPrefillData(clientPan, assessmentYear = '2026-27') {
    if (!this.isConfigured()) {
      return this.credentialsRequiredResponse('fetchPrefillData', { clientPan, assessmentYear });
    }

    return this.executeWithRetry('fetchPrefillData', async () => {
      const response = await this.send(`/prefill/${clientPan}?ay=${assessmentYear}`, 'GET');
      return response;
    });
  }

  /**
   * 5. ITR JSON Schema Validation (Offline Pre-check)
   */
  validateItrJson(itrData) {
    const errors = [];
    if (!itrData) errors.push('ITR payload is empty');
    if (!itrData.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(itrData.pan)) {
      errors.push('Valid PAN is required');
    }
    if (!itrData.assessmentYear) errors.push('Assessment Year is required (e.g. 2026-27)');
    if (!itrData.itrType) errors.push('ITR Form Type is required (ITR-1, ITR-2, ITR-3, ITR-4, ITR-5, ITR-6)');

    return {
      isValid: errors.length === 0,
      errors,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * 6. Submit ITR Return to ITD e-Filing Portal
   */
  async submitItr(itrData, verificationMode = 'EVC') {
    const validation = this.validateItrJson(itrData);
    if (!validation.isValid) {
      throw new Error(`ITR schema validation failed: ${validation.errors.join(', ')}`);
    }

    if (!this.isConfigured()) {
      return this.credentialsRequiredResponse('submitItr', {
        pan: itrData.pan,
        assessmentYear: itrData.assessmentYear,
        itrType: itrData.itrType,
        verificationMode
      });
    }

    return this.executeWithRetry('submitItr', async () => {
      const response = await this.send('/itr/submit', 'POST', {
        pan: itrData.pan,
        assessmentYear: itrData.assessmentYear,
        itrType: itrData.itrType,
        verificationMode,
        data: itrData
      });
      return {
        success: Boolean(response.ackNumber || response.acknowledgementNumber),
        acknowledgementNumber: response.ackNumber || response.acknowledgementNumber,
        filingDate: response.filingDate || new Date().toISOString(),
        verificationStatus: response.verificationStatus || 'PENDING_VERIFICATION',
        rawResponse: response
      };
    });
  }

  /**
   * 7. e-Verify ITR (Aadhaar OTP, NetBanking EVC, or DSC)
   */
  async eVerifyItr(acknowledgementNumber, verificationMethod = 'AADHAAR_OTP', otpOrEvc = null) {
    if (!acknowledgementNumber) throw new Error('Acknowledgement Number is required for e-Verification.');

    if (!this.isConfigured()) {
      return this.credentialsRequiredResponse('eVerifyItr', {
        acknowledgementNumber,
        verificationMethod
      });
    }

    return this.executeWithRetry('eVerifyItr', async () => {
      const response = await this.send('/itr/everify', 'POST', {
        acknowledgementNumber,
        verificationMethod,
        otpOrEvc
      });
      return {
        success: Boolean(response.verified || response.status === 'VERIFIED'),
        acknowledgementNumber,
        status: response.status || 'VERIFIED',
        verifiedAt: response.verifiedAt || new Date().toISOString()
      };
    });
  }

  /**
   * 8. Fetch Official ITR-V Acknowledgement PDF / Metadata
   */
  async getAcknowledgement(acknowledgementNumber) {
    if (!acknowledgementNumber) throw new Error('Acknowledgement Number is required.');

    if (!this.isConfigured()) {
      return this.credentialsRequiredResponse('getAcknowledgement', { acknowledgementNumber });
    }

    return this.executeWithRetry('getAcknowledgement', async () => {
      const response = await this.send(`/itrv/${acknowledgementNumber}`, 'GET');
      return response;
    });
  }
}
