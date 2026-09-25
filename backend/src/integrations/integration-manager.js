import { EInvoiceProviderAdapter } from './einvoice-adapter.js';
import { EWayBillProviderAdapter } from './ewaybill-adapter.js';
import { GstProviderAdapter } from './gst-adapter.js';
import { TdsProviderAdapter } from './traces-adapter.js';
import { AccountAggregatorAdapter } from './account-aggregator-adapter.js';
import { PayrollComplianceAdapter } from './payroll-compliance-adapter.js';
import { IncomeTaxEriAdapter } from './eri-adapter.js';

export class IntegrationManager {
  constructor() {
    this.adapters = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register('EINVOICE', new EInvoiceProviderAdapter());
    this.register('EWAYBILL', new EWayBillProviderAdapter());
    this.register('GST', new GstProviderAdapter());
    this.register('TDS', new TdsProviderAdapter());
    this.register('BANK', new AccountAggregatorAdapter());
    this.register('PAYROLL', new PayrollComplianceAdapter());
    this.register('ERI', new IncomeTaxEriAdapter());
  }

  register(key, adapter) {
    this.adapters.set(key.toUpperCase(), adapter);
  }

  getAdapter(key) {
    return this.adapters.get(key.toUpperCase()) || null;
  }

  async getAllProvidersStatus() {
    const PROVIDER_METADATA = {
      EINVOICE: {
        description: 'NIC E-Invoice System for B2B e-invoicing, IRN generation, and signed QR code issuance.',
        schemaVersion: 'NIC JSON Schema v1.03',
        authType: 'GSP Client ID & Secret / Auth Token'
      },
      EWAYBILL: {
        description: 'National Informatics Centre (NIC) E-Way Bill generation, Part-A/Part-B updating, and vehicle extension.',
        schemaVersion: 'NIC EWB Schema v1.03',
        authType: 'GSP Client ID & Secret / User Credentials'
      },
      GST: {
        description: 'GSTN Government System for GSTR-1, GSTR-3B filings, and GSTR-2B inward supplies download.',
        schemaVersion: 'GSTN Returns API v0.3',
        authType: 'GSP Session Token & AppKey Encryption'
      },
      TDS: {
        description: 'NSDL e-TDS & TRACES System for Form 26Q return submission and ITNS 281 Challan verification.',
        schemaVersion: 'Income Tax e-TDS FVU Standard',
        authType: 'TRACES TAN & Portal Credentials'
      },
      BANK: {
        description: 'ReBIT Account Aggregator (AA) ecosystem for consent-driven automated bank statement ingestion and reconciliation.',
        schemaVersion: 'ReBIT AA Specification v1.1.2',
        authType: 'FIU OAuth2 & Curve25519 Key Exchange'
      },
      PAYROLL: {
        description: 'EPFO & ESIC compliance gateway for monthly Electronic Challan cum Return (ECR) generation and TRRN verification.',
        schemaVersion: 'EPFO ECR Standard #~# Format',
        authType: 'Shram Suvidha / Unified Portal Credentials'
      },
      ERI: {
        description: 'Income Tax Department Electronic Return Intermediary (ERI) gateway for ITR validation and submission.',
        schemaVersion: 'ITD e-Filing Schema AY 2026-27',
        authType: 'Class 3 Digital Signature Certificate (DSC) & ERI Auth'
      }
    };

    const statuses = [];
    for (const [key, adapter] of this.adapters.entries()) {
      const health = await adapter.healthCheck();
      const meta = PROVIDER_METADATA[key] || {
        description: adapter.providerName,
        schemaVersion: '1.0',
        authType: 'API Key / Token'
      };

      statuses.push({
        key,
        name: adapter.providerName,
        description: meta.description,
        schemaVersion: meta.schemaVersion,
        authType: meta.authType,
        environment: adapter.environment,
        connected: health.connected,
        status: health.status,
        message: health.message,
        requiredEnvVars: health.requiredEnvVars || [],
        lastChecked: new Date().toISOString(),
        lastError: health.connected ? null : health.message,
        activationStatus: health.connected ? 'ACTIVE' : 'PENDING_CONFIG',
        isDisabledByDefault: key === 'ERI'
      });
    }
    return statuses;
  }

  async testConnection(key) {
    const adapter = this.getAdapter(key);
    if (!adapter) throw new Error(`Unknown provider key: ${key}`);
    return adapter.healthCheck();
  }
}

export const integrationManager = new IntegrationManager();
