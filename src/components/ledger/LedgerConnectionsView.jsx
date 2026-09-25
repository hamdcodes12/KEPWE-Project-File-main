import React, { useEffect, useState } from 'react';
import {
  createLedgerAaConsent,
  createLedgerPaymentLink,
  fetchLedgerAaConsents,
  fetchLedgerAaConsent,
  revokeLedgerAaConsent,
  notifyLedgerAaConsent,
  requestLedgerAaFi,
  fetchLedgerAaConsentEvents,
  fetchLedgerAaAccounts,
  fetchLedgerIntegrationStatus,
  discoverLedgerAaAccounts,
  linkLedgerAaAccount,
  syncLedgerAaAccount,
  disconnectLedgerAaAccount,
  fetchLedgerAaAccountData,
  verifyLedgerBankAccount,
  verifyLedgerIfsc,
  verifyLedgerPennyDrop,
  verifyLedgerUpi,
  fetchLedgerIdspayBalance,
  fetchLedgerIdspayTransactions,
  fetchLedgerIdspayStatement,
} from '../../api/ledgerClient';

const initialState = { accountNumber: '', ifsc: '', name: '', vpa: '', customerHandle: '', dateFrom: '', dateTo: '' };

export default function LedgerConnectionsView() {
  const [status, setStatus] = useState([]);
  const [consents, setConsents] = useState([]);
  const [aaAccounts, setAaAccounts] = useState([]);
  const [form, setForm] = useState(initialState);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState({ provider: 'razorpay', amount: '', description: 'KEPWE Ledger payment' });

  const load = async () => {
    setError('');
    const [statusResponse, consentResponse, accountResponse] = await Promise.all([fetchLedgerIntegrationStatus(), fetchLedgerAaConsents(), fetchLedgerAaAccounts()]);
    if (statusResponse.ok) setStatus(statusResponse.data.integrations || []);
    if (consentResponse.ok) setConsents(consentResponse.data.consents || []);
    if (accountResponse.ok) setAaAccounts(accountResponse.data.accounts || []);
    if (!statusResponse.ok || !consentResponse.ok || !accountResponse.ok) setError('Unable to load integration state.');
  };
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updatePayment = (key, value) => setPayment((current) => ({ ...current, [key]: value }));
  const call = async (action) => {
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await action();
      if (!response.ok) setError(response.data?.error || response.data?.message || 'Provider request failed.');
      else setResult(response.data);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="prod-view-container">
      <div className="prod-view-header">
        <div className="prod-view-title-group"><h2>Bank Connections & Provider Workflows</h2><p>Verified provider calls and consent-driven account connections. No provider credentials means Integration not configured.</p></div>
        <button className="btn-secondary" onClick={() => load().catch((err) => setError(err.message))}>Refresh</button>
      </div>
      {error && <div className="prod-alert-banner danger">{error}</div>}
      {result && <pre className="prod-card" style={{ padding: 16, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>}
      <div className="prod-card" style={{ padding: 20 }}>
        <h3>IDSPay verification</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <input className="prod-input" placeholder="Account number" value={form.accountNumber} onChange={(e) => update('accountNumber', e.target.value)} />
          <input className="prod-input" placeholder="IFSC" value={form.ifsc} onChange={(e) => update('ifsc', e.target.value)} />
          <input className="prod-input" placeholder="Account holder name" value={form.name} onChange={(e) => update('name', e.target.value)} />
          <input className="prod-input" placeholder="UPI VPA" value={form.vpa} onChange={(e) => update('vpa', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn-secondary" disabled={busy} onClick={() => call(() => verifyLedgerIfsc({ ifsc: form.ifsc }))}>Verify IFSC</button>
          <button className="btn-secondary" disabled={busy} onClick={() => call(() => verifyLedgerBankAccount({ accountNumber: form.accountNumber, ifsc: form.ifsc, name: form.name }))}>Verify bank account</button>
          <button className="btn-secondary" disabled={busy} onClick={() => call(() => verifyLedgerPennyDrop({ accountNumber: form.accountNumber, ifsc: form.ifsc, name: form.name }))}>Penny drop</button>
          <button className="btn-secondary" disabled={busy} onClick={() => call(() => verifyLedgerUpi({ vpa: form.vpa, name: form.name }))}>Verify UPI</button>
          <button className="btn-secondary" disabled={busy || !form.accountNumber} onClick={() => call(() => fetchLedgerIdspayBalance({ accountNumber: form.accountNumber, ifsc: form.ifsc }))}>Fetch balance</button>
          <button className="btn-secondary" disabled={busy || !form.accountNumber} onClick={() => call(() => fetchLedgerIdspayTransactions({ accountNumber: form.accountNumber, ifsc: form.ifsc, dateFrom: form.dateFrom || today, dateTo: form.dateTo || today }))}>Fetch transactions</button>
          <button className="btn-secondary" disabled={busy || !form.accountNumber} onClick={() => call(() => fetchLedgerIdspayStatement({ accountNumber: form.accountNumber, ifsc: form.ifsc, dateFrom: form.dateFrom || today, dateTo: form.dateTo || today }))}>Fetch statement</button>
        </div>
      </div>
      <div className="prod-card" style={{ padding: 20 }}>
        <h3>Account Aggregator consent</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <input className="prod-input" placeholder="Customer handle" value={form.customerHandle} onChange={(e) => update('customerHandle', e.target.value)} />
          <input className="prod-input" type="date" value={form.dateFrom || today} onChange={(e) => update('dateFrom', e.target.value)} />
          <input className="prod-input" type="date" value={form.dateTo || today} onChange={(e) => update('dateTo', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn-secondary" disabled={busy || !form.customerHandle} onClick={() => call(async () => { const response = await discoverLedgerAaAccounts({ customerHandle: form.customerHandle }); if (response.ok) setAaAccounts(response.data.accounts || []); return response; })}>Discover accounts</button>
          <button className="btn-primary" disabled={busy || !form.customerHandle} onClick={() => call(() => createLedgerAaConsent({ customerHandle: form.customerHandle, dateFrom: form.dateFrom || today, dateTo: form.dateTo || today }))}>Create consent</button>
        </div>
        {consents.length > 0 && <ul>{consents.map((consent) => <li key={consent.id} style={{ marginTop: 8 }}>
          <div>{consent.provider_consent_id || consent.id} - {consent.status}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <button className="btn-secondary" disabled={busy} onClick={() => call(() => fetchLedgerAaConsent(consent.id))}>Status</button>
            <button className="btn-secondary" disabled={busy} onClick={() => call(() => notifyLedgerAaConsent(consent.id, { channel: 'WEBHOOK' }))}>Notify</button>
            <button className="btn-secondary" disabled={busy} onClick={() => call(() => requestLedgerAaFi(consent.id, { dateFrom: form.dateFrom || today, dateTo: form.dateTo || today }))}>Request FI</button>
            <button className="btn-secondary" disabled={busy} onClick={() => call(() => fetchLedgerAaConsentEvents(consent.id))}>History</button>
            <button className="btn-secondary" disabled={busy} onClick={() => call(async () => { const response = await revokeLedgerAaConsent(consent.id); if (response.ok) await load(); return response; })}>Revoke</button>
          </div>
        </li>)}</ul>}
      </div>
      <div className="prod-card" style={{ padding: 20 }}>
        <h3>Connected accounts</h3>
        {aaAccounts.length === 0 ? <p>No connected accounts.</p> : aaAccounts.map((account) => (
          <div key={account.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E2E8F0' }}>
            <div><strong>{account.fip_id || 'Bank account'}</strong><div>{account.masked_account_number || account.provider_account_id} · {account.connection_status} · Last synced: {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Never'}</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              {account.connection_status !== 'CONNECTED' && <button className="btn-secondary" disabled={busy} onClick={() => call(() => linkLedgerAaAccount({ accountId: account.provider_account_id, customerHandle: form.customerHandle }))}>Link</button>}
              <button className="btn-secondary" disabled={busy || account.connection_status === 'DISCONNECTED'} onClick={() => call(async () => { const response = await syncLedgerAaAccount(account.id, {}); if (response.ok) await load(); return response; })}>Sync now</button>
              <button className="btn-secondary" disabled={busy || account.connection_status === 'DISCONNECTED'} onClick={() => call(() => fetchLedgerAaAccountData(account.id, 'details'))}>Details</button>
              <button className="btn-secondary" disabled={busy || account.connection_status === 'DISCONNECTED'} onClick={() => call(() => fetchLedgerAaAccountData(account.id, 'balance'))}>Balance</button>
              <button className="btn-secondary" disabled={busy || account.connection_status === 'DISCONNECTED'} onClick={() => call(() => fetchLedgerAaAccountData(account.id, 'transactions'))}>Transactions</button>
              <button className="btn-secondary" disabled={busy || account.connection_status === 'DISCONNECTED'} onClick={() => call(() => fetchLedgerAaAccountData(account.id, 'statements'))}>Statements</button>
              <button className="btn-secondary" disabled={busy || account.connection_status === 'DISCONNECTED'} onClick={() => call(async () => { const response = await disconnectLedgerAaAccount(account.id); if (response.ok) await load(); return response; })}>Disconnect</button>
            </div>
          </div>
        ))}
      </div>
      <div className="prod-card" style={{ padding: 20 }}>
        <h3>Payment link</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="prod-select" value={payment.provider} onChange={(e) => updatePayment('provider', e.target.value)}>
            <option value="razorpay">Razorpay</option><option value="cashfree">Cashfree</option>
          </select>
          <input className="prod-input" type="number" min="0.01" step="0.01" placeholder="Amount" value={payment.amount} onChange={(e) => updatePayment('amount', e.target.value)} />
          <button className="btn-primary" disabled={busy || !(Number(payment.amount) > 0)} onClick={() => call(() => createLedgerPaymentLink({ ...payment, amount: Number(payment.amount) }))}>Create payment link</button>
        </div>
      </div>
      <div className="prod-card" style={{ padding: 20 }}><h3>Integration status</h3><ul>{status.map((item) => <li key={item.provider}>{item.provider}: {item.message}</li>)}</ul></div>
    </div>
  );
}
