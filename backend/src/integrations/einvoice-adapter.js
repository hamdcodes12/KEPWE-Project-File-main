import { BaseProviderAdapter } from './base-provider-adapter.js';

export class EInvoiceProviderAdapter extends BaseProviderAdapter {
  constructor(options = {}) {
    super('EINVOICE', 'NIC E-Invoice System (GSP / IRP)', {
      baseUrl: options.baseUrl || process.env.EINVOICE_BASE_URL || (process.env.EINVOICE_ENV === 'production' ? 'https://einv-apisandbox.nic.in/eivp/v1.03' : 'https://einv-apisandbox.nic.in/eivp/v1.03'),
      ...options
    });
  }

  /**
   * Generates Invoice Reference Number (IRN) and Signed QR Code
   */
  async generateIrn(invoicePayload) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'E-Invoice provider is not connected. NIC/GSP credentials (EINVOICE_CLIENT_ID and EINVOICE_CLIENT_SECRET) must be configured.',
        details: 'To generate real IRNs, configure valid sandbox/production credentials in .env and run connection test.'
      };
    }

    await this.ensureAuthenticated();
    const normalizedPayload = this.normalizeInvoiceForIrp(invoicePayload);
    const response = await this.send('/Invoice', 'POST', normalizedPayload);

    return {
      success: true,
      status: 'GENERATED',
      irn: response.Irn,
      ackNo: response.AckNo,
      ackDt: response.AckDt,
      signedInvoice: response.SignedInvoice,
      signedQrCode: response.SignedQRCode,
      rawResponse: response
    };
  }

  /**
   * Fetches details of an existing IRN
   */
  async getIrnDetails(irn) {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'E-Invoice provider is not connected. Credentials required.'
      };
    }
    await this.ensureAuthenticated();
    return this.send(`/Invoice/irn/${irn}`, 'GET');
  }

  /**
   * Cancels an IRN within 24 hours of generation
   */
  async cancelIrn(irn, cancelReasonCode = '1', cancelRemarks = 'Data entry error') {
    if (!this.hasCredentials()) {
      return {
        success: false,
        status: 'CREDENTIALS_REQUIRED',
        error: 'E-Invoice provider is not connected. Credentials required.'
      };
    }
    await this.ensureAuthenticated();
    const response = await this.send('/Invoice/Cancel', 'POST', {
      Irn: irn,
      CnlRsn: String(cancelReasonCode),
      CnlRem: cancelRemarks
    });
    return {
      success: true,
      status: 'CANCELLED',
      irn: response.Irn,
      cancelDate: response.CancelDate
    };
  }

  /**
   * Normalizes internal invoice structure to statutory NIC e-Invoice JSON Schema v1.03
   */
  normalizeInvoiceForIrp(inv) {
    return {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: inv.supplyType === 'B2B' ? 'B2B' : 'B2C',
        RegRev: inv.reverseCharge ? 'Y' : 'N'
      },
      DocDtls: {
        Typ: 'INV',
        No: inv.invoiceNumber,
        Dt: inv.invoiceDate?.split('-').reverse().join('/') // DD/MM/YYYY
      },
      SellerDtls: {
        Gstin: inv.supplierGstin,
        LglNm: inv.supplierLegalName,
        Addr1: inv.supplierAddress,
        Loc: inv.supplierCity || 'Mumbai',
        Pin: Number(inv.supplierPincode || 400051),
        Stcd: inv.supplierStateCode || '27'
      },
      BuyerDtls: {
        Gstin: inv.customerGstin,
        LglNm: inv.customerName,
        Pos: inv.placeOfSupplyCode || '27',
        Addr1: inv.billingAddress || 'Customer Address',
        Loc: inv.customerCity || 'City',
        Pin: Number(inv.customerPincode || 400001),
        Stcd: inv.placeOfSupplyCode || '27'
      },
      ItemList: (inv.items || []).map((item, idx) => ({
        SlNo: String(idx + 1),
        PrdDesc: item.itemDescription,
        IsServc: item.hsnSac?.startsWith('99') ? 'Y' : 'N',
        HsnCd: item.hsnSac,
        Qty: item.quantity,
        Unit: item.unit || 'NOS',
        UnitPrice: item.unitPrice,
        TotAmt: item.taxableValue + item.discountAmount,
        Discount: item.discountAmount,
        AssAmt: item.taxableValue,
        GstRt: item.gstRate,
        IgstAmt: item.igstAmount,
        CgstAmt: item.cgstAmount,
        SgstAmt: item.sgstAmount,
        TotItemVal: item.totalItemAmount
      })),
      ValDtls: {
        AssVal: inv.taxableAmount,
        CgstVal: inv.cgstAmount,
        SgstVal: inv.sgstAmount,
        IgstVal: inv.igstAmount,
        Discount: inv.discountAmount,
        TotInvVal: inv.totalAmount
      }
    };
  }
}
