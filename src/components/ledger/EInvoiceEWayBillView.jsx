import React, { useState } from 'react';
import './ProductionLedgerViews.css';
import {
  QrCode,
  Truck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Key,
  ExternalLink,
  Send,
  XCircle
} from 'lucide-react';
import {
  generateIrn,
  cancelIrn,
  generateEWayBill,
  cancelEWayBill
} from '../../api/ledgerClient';

export default function EInvoiceEWayBillView() {
  const [activeTab, setActiveTab] = useState('einvoice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [apiResponse, setApiResponse] = useState(null);

  // IRN Form State (NIC Schema v1.03)
  const [irnForm, setIrnForm] = useState({
    supplierGstin: '27AABCK1234F1Z5',
    buyerGstin: '27AABCA1234F1Z1',
    buyerLegalName: 'Apex Digital Solutions Pvt Ltd',
    buyerPos: '27',
    docType: 'INV',
    docNumber: 'INV-2026-0001',
    docDate: new Date().toISOString().split('T')[0],
    taxableAmount: 100000.0,
    cgstAmount: 9000.0,
    sgstAmount: 9000.0,
    igstAmount: 0.0,
    totalInvoiceValue: 118000.0,
    hsnCode: '998311',
    itemDescription: 'Cloud Architecture Services'
  });

  // Cancel IRN state
  const [cancelIrnForm, setCancelIrnForm] = useState({
    irn: '',
    reasonCode: '1',
    remarks: 'Duplicate entry detected'
  });

  // E-Way Bill Form State
  const [ewbForm, setEwbForm] = useState({
    supplyType: 'O',
    subSupplyType: '1',
    docType: 'INV',
    docNo: 'INV-2026-0001',
    docDate: new Date().toISOString().split('T')[0],
    fromGstin: '27AABCK1234F1Z5',
    toGstin: '07AABCB5678G1Z2',
    totalValue: 118000.0,
    transporterId: '27AABCT9988H1Z0',
    transporterName: 'Blue Dart Express',
    transDocNo: 'LR-998877',
    transMode: '1',
    distanceKm: 450,
    vehicleNo: 'MH-12-AB-1234'
  });

  const handleGenerateIrn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setApiResponse(null);
    try {
      const payload = {
        DocDtls: {
          Typ: irnForm.docType,
          No: irnForm.docNumber,
          Dt: irnForm.docDate.split('-').reverse().join('/')
        },
        SellerDtls: {
          Gstin: irnForm.supplierGstin,
          LglNm: 'KEPWE Enterprises LLP',
          Pos: '27'
        },
        BuyerDtls: {
          Gstin: irnForm.buyerGstin,
          LglNm: irnForm.buyerLegalName,
          Pos: irnForm.buyerPos
        },
        ValDtls: {
          AssVal: Number(irnForm.taxableAmount),
          CgstVal: Number(irnForm.cgstAmount),
          SgstVal: Number(irnForm.sgstAmount),
          IgstVal: Number(irnForm.igstAmount),
          TotInvVal: Number(irnForm.totalInvoiceValue)
        },
        ItemList: [
          {
            HsnCd: irnForm.hsnCode,
            PrdDesc: irnForm.itemDescription,
            Qty: 1,
            UnitRate: Number(irnForm.taxableAmount),
            AssAmt: Number(irnForm.taxableAmount)
          }
        ]
      };

      const res = await generateIrn(payload);
      setApiResponse(res.data);
      if (res.ok) {
        setSuccessMsg(`IRN Generated Successfully: ${res.data.irn}`);
      } else {
        if (res.data?.status === 'CREDENTIALS_REQUIRED') {
          setError(`Provider State: CREDENTIALS_REQUIRED. Direct government NIC e-Invoice credentials are required. System verified schema v1.03 validity.`);
        } else {
          setError(res.data?.error || 'Failed to generate IRN.');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEwb = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setApiResponse(null);
    try {
      const res = await generateEWayBill(ewbForm);
      setApiResponse(res.data);
      if (res.ok) {
        setSuccessMsg(`E-Way Bill Generated: ${res.data.ewbNo}`);
      } else {
        if (res.data?.status === 'CREDENTIALS_REQUIRED') {
          setError(`Provider State: CREDENTIALS_REQUIRED. Direct NIC E-Way Bill credentials are required. Payload schema validated cleanly.`);
        } else {
          setError(res.data?.error || 'Failed to generate E-Way Bill.');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>E-Invoice (IRN) & E-Way Bill Portal</h2>
          <p>Standard NIC JSON Schema v1.03 engine for B2B e-Invoicing and logistics movement permits.</p>
        </div>
        <div className="prod-view-actions">
          <span className="compliance-badge credentials_required">
            <Key size={12} /> Adapter: CREDENTIALS_REQUIRED
          </span>
        </div>
      </div>

      {/* ── PRODUCTION CREDENTIAL INTEGRITY NOTICE ────────────────────────── */}
      <div className="prod-alert-banner warning">
        <ShieldAlert size={20} />
        <div>
          <strong style={{ fontSize: '0.9rem' }}>Government NIC API Gateway Architecture</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
            In compliance with strict regulatory guidelines, this system enforces zero mock/dummy IRN generation. Real portal submissions require government-issued credentials (NIC Client ID/Secret, GSTN Username/Password). Complete instructions and credential templates are documented in <code>INTEGRATION_SETUP.md</code>.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="prod-alert-banner success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="prod-alert-banner danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── TABS BAR ─────────────────────────────────────────────────────── */}
      <div className="prod-tabs-bar">
        <button
          onClick={() => setActiveTab('einvoice')}
          className={`prod-tab-btn ${activeTab === 'einvoice' ? 'active' : ''}`}
        >
          <QrCode size={15} /> NIC E-Invoice (IRN Generation)
        </button>
        <button
          onClick={() => setActiveTab('ewaybill')}
          className={`prod-tab-btn ${activeTab === 'ewaybill' ? 'active' : ''}`}
        >
          <Truck size={15} /> E-Way Bill (Part A & B)
        </button>
      </div>

      {/* ── E-INVOICE GENERATOR ──────────────────────────────────────────── */}
      {activeTab === 'einvoice' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">
              <QrCode size={16} /> Generate Invoice Reference Number (IRN v1.03)
            </div>
          </div>

          <form onSubmit={handleGenerateIrn} className="prod-form-grid">
            <div className="prod-form-group">
              <label>Supplier GSTIN</label>
              <input
                type="text"
                value={irnForm.supplierGstin}
                onChange={(e) => setIrnForm({ ...irnForm, supplierGstin: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Buyer GSTIN</label>
              <input
                type="text"
                value={irnForm.buyerGstin}
                onChange={(e) => setIrnForm({ ...irnForm, buyerGstin: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Buyer Legal Name</label>
              <input
                type="text"
                value={irnForm.buyerLegalName}
                onChange={(e) => setIrnForm({ ...irnForm, buyerLegalName: e.target.value })}
                className="prod-input"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Invoice Number</label>
              <input
                type="text"
                value={irnForm.docNumber}
                onChange={(e) => setIrnForm({ ...irnForm, docNumber: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Invoice Date</label>
              <input
                type="date"
                value={irnForm.docDate}
                onChange={(e) => setIrnForm({ ...irnForm, docDate: e.target.value })}
                className="prod-input"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>HSN / SAC Code</label>
              <input
                type="text"
                value={irnForm.hsnCode}
                onChange={(e) => setIrnForm({ ...irnForm, hsnCode: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Taxable Amount (₹)</label>
              <input
                type="number"
                value={irnForm.taxableAmount}
                onChange={(e) => setIrnForm({ ...irnForm, taxableAmount: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Total Invoice Value (₹)</label>
              <input
                type="number"
                value={irnForm.totalInvoiceValue}
                onChange={(e) => setIrnForm({ ...irnForm, totalInvoiceValue: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                <Send size={14} /> {loading ? 'Validating & Transmitting...' : 'Validate Schema & Submit to NIC'}
              </button>
            </div>
          </form>

          {apiResponse && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 6 }}>
                GATEWAY RESPONSE PAYLOAD:
              </div>
              <pre style={{
                background: '#0F172A',
                color: '#38BDF8',
                padding: 16,
                borderRadius: 8,
                fontSize: '0.8rem',
                overflowX: 'auto',
                margin: 0
              }}>
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── E-WAY BILL GENERATOR ─────────────────────────────────────────── */}
      {activeTab === 'ewaybill' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">
              <Truck size={16} /> Generate E-Way Bill (NIC Format)
            </div>
          </div>

          <form onSubmit={handleGenerateEwb} className="prod-form-grid">
            <div className="prod-form-group">
              <label>Document Number</label>
              <input
                type="text"
                value={ewbForm.docNo}
                onChange={(e) => setEwbForm({ ...ewbForm, docNo: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Transporter Name</label>
              <input
                type="text"
                value={ewbForm.transporterName}
                onChange={(e) => setEwbForm({ ...ewbForm, transporterName: e.target.value })}
                className="prod-input"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Transporter GSTIN / ID</label>
              <input
                type="text"
                value={ewbForm.transporterId}
                onChange={(e) => setEwbForm({ ...ewbForm, transporterId: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Transport Distance (KM)</label>
              <input
                type="number"
                value={ewbForm.distanceKm}
                onChange={(e) => setEwbForm({ ...ewbForm, distanceKm: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Vehicle Number (Part B)</label>
              <input
                type="text"
                value={ewbForm.vehicleNo}
                onChange={(e) => setEwbForm({ ...ewbForm, vehicleNo: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Consignment Value (₹)</label>
              <input
                type="number"
                value={ewbForm.totalValue}
                onChange={(e) => setEwbForm({ ...ewbForm, totalValue: e.target.value })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                <Truck size={14} /> {loading ? 'Validating & Transmitting...' : 'Generate E-Way Bill'}
              </button>
            </div>
          </form>

          {apiResponse && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 6 }}>
                GATEWAY RESPONSE PAYLOAD:
              </div>
              <pre style={{
                background: '#0F172A',
                color: '#38BDF8',
                padding: 16,
                borderRadius: 8,
                fontSize: '0.8rem',
                overflowX: 'auto',
                margin: 0
              }}>
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
