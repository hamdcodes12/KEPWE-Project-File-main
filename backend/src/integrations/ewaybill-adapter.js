import { BaseProviderAdapter } from './base-provider-adapter.js';

export class EWayBillProviderAdapter extends BaseProviderAdapter {
  constructor(options = {}) {
    super('EWAYBILL', 'NIC E-Way Bill System', {
      baseUrl: options.baseUrl || process.env.EWAYBILL_BASE_URL || (process.env.EWAYBILL_ENV === 'production' ? 'https://ewaybillgst.gov.in/api' : 'https://ewb.nic.in/api/sandbox'),
      ...options
    });
  }

  /**
   * Generates E-Way Bill (Part A & Part B)
   */
  async generateEWayBill(ewbPayload) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'E-Way Bill provider is not connected. NIC credentials (EWAYBILL_CLIENT_ID and EWAYBILL_CLIENT_SECRET) must be configured.',
        details: 'To generate real E-Way Bills, supply verified transporter/taxpayer credentials.'
      };
    }

    await this.ensureAuthenticated();
    const normalized = this.normalizeEWayBillPayload(ewbPayload);
    const response = await this.send('/ewayapi/v1.03/genewaybill', 'POST', normalized);

    return {
      success: true,
      status: 'GENERATED',
      ewayBillNo: response.ewayBillNo,
      ewayBillDate: response.ewayBillDate,
      validUpto: response.validUpto,
      rawResponse: response
    };
  }

  /**
   * Fetches an existing E-Way Bill by number
   */
  async getEWayBill(ewbNo) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'E-Way Bill provider is not connected. Credentials required.'
      };
    }
    await this.ensureAuthenticated();
    return this.send(`/ewayapi/v1.03/GetEwayBill?ewbNo=${ewbNo}`, 'GET');
  }

  /**
   * Cancels an E-Way Bill within 24 hours of generation
   */
  async cancelEWayBill(ewbNo, cancelReasonCode = 1, cancelRemarks = 'Order cancelled') {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'E-Way Bill provider is not connected. Credentials required.'
      };
    }
    await this.ensureAuthenticated();
    const response = await this.send('/ewayapi/v1.03/cancelewbb', 'POST', {
      ewbNo: Number(ewbNo),
      cancelRsnCode: Number(cancelReasonCode),
      cancelRmrk: cancelRemarks
    });
    return {
      success: true,
      status: 'CANCELLED',
      ewayBillNo: ewbNo,
      cancelDate: response.cancelDate
    };
  }

  /**
   * Normalizes to NIC E-Way Bill JSON Schema v1.03
   */
  normalizeEWayBillPayload(data) {
    return {
      supplyType: data.supplyType || 'O', // Outward
      subSupplyType: data.subSupplyType || 1, // Supply
      docType: 'INV',
      docNo: data.invoiceNumber,
      docDate: data.invoiceDate?.split('-').reverse().join('/'),
      fromGstin: data.fromGstin,
      fromTrdName: data.fromTradeName,
      fromAddr1: data.fromAddress,
      fromPlace: data.fromCity || 'Mumbai',
      fromPincode: Number(data.fromPincode || 400051),
      actFromStateCode: Number(data.fromStateCode || 27),
      fromStateCode: Number(data.fromStateCode || 27),
      toGstin: data.toGstin || 'URP',
      toTrdName: data.toName,
      toAddr1: data.toAddress,
      toPlace: data.toCity || 'City',
      toPincode: Number(data.toPincode || 400001),
      actToStateCode: Number(data.toStateCode || 27),
      toStateCode: Number(data.toStateCode || 27),
      totalValue: data.taxableAmount,
      cgstValue: data.cgstAmount || 0,
      sgstValue: data.sgstAmount || 0,
      igstValue: data.igstAmount || 0,
      totInvValue: data.totalAmount,
      transDistance: Number(data.transDistance || 50),
      transporterId: data.transporterId || '',
      transporterName: data.transporterName || '',
      transDocNo: data.transDocNo || '',
      transDocDate: data.transDocDate || '',
      vehicleNo: data.vehicleNo || '',
      vehicleType: data.vehicleType || 'R' // Regular
    };
  }
}
