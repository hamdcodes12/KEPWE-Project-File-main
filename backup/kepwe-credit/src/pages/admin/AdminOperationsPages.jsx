import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, CreditCard, Eye, FileText, RefreshCw, Save, Search, ShieldCheck, Tag, Users, X } from 'lucide-react';
import { adminFetch } from '../../api/adminClient';

const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' };
const input = { padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#172033', fontSize: '0.84rem' };
const button = { padding: '8px 12px', borderRadius: '7px', border: '1px solid #D9E2F0', background: '#FFFFFF', color: '#172033', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' };
const primary = { ...button, background: '#214ECF', borderColor: '#214ECF', color: '#FFFFFF' };
const fmtDate = (value) => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

function Notice({ error }) { return error ? <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, color: '#B42318', background: '#FEF3F2', border: '1px solid #FECDCA', fontSize: '.82rem' }}>{error}</div> : null; }
function Loading({ children = 'Loading…' }) { return <div style={{ padding: 44, color: '#64748B', textAlign: 'center' }}>{children}</div>; }
function Pager({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 14, borderTop: '1px solid #E2E8F0', color: '#64748B', fontSize: '.78rem' }}>
    <span>{pagination.total} records · page {pagination.page} of {pagination.totalPages}</span>
    <div style={{ display: 'flex', gap: 8 }}><button style={button} disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button><button style={button} disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Next</button></div>
  </div>;
}
function PageTitle({ title, description, onRefresh, onExport }) { const exportPath = title === 'Subscriptions' ? '/admin/export/subscriptions.csv' : title === 'Payments & invoices' ? '/admin/export/payments.csv' : null; return <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}><div><h2 style={{ margin: 0, color: '#172033', fontSize: '1.3rem' }}>{title}</h2><p style={{ margin: '5px 0 0', color: '#64748B', fontSize: '.82rem' }}>{description}</p></div><div style={{ display: 'flex', gap: 8 }}>{exportPath && <button style={button} onClick={() => downloadAdminCsv(exportPath, exportPath.split('/').pop()).catch(() => window.alert('Export failed.'))}>Export CSV</button>}{onExport && <button style={button} onClick={onExport}>Export CSV</button>}{onRefresh && <button style={button} onClick={onRefresh}><RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Refresh</button>}</div></div>; }
async function downloadAdminCsv(path, filename) { const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('kepwe_admin_access_token') || ''}` } }); if (!response.ok) throw new Error('Export failed'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function Modal({ title, children, onClose }) { return <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.66)', zIndex: 3000, display: 'grid', placeItems: 'center', padding: 20 }}><div style={{ maxWidth: 760, width: '100%', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 14 }}><div style={{ padding: '17px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}><strong>{title}</strong><button aria-label="Close" onClick={onClose} style={{ ...button, padding: 5, border: 0 }}><X size={18} /></button></div><div style={{ padding: 20 }}>{children}</div></div></div>; }
function Status({ value }) { const ok = ['active', 'Paid', 'Completed', 'Converted'].includes(value); return <span style={{ fontSize: '.7rem', fontWeight: 800, borderRadius: 6, padding: '4px 8px', color: ok ? '#047857' : '#9A6700', background: ok ? '#ECFDF5' : '#FFFAEB' }}>{value || '—'}</span>; }

export function AdminSubscriptionsPage() {
  const [data, setData] = useState({ subscriptions: [], pagination: null }); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [detail, setDetail] = useState(null);
  const load = useCallback(async () => { setLoading(true); const qs = new URLSearchParams({ page, pageSize: 25 }); if (search) qs.set('search', search); if (status) qs.set('status', status); const res = await adminFetch(`/admin/subscriptions?${qs}`); if (res.ok) setData(res.data); else setError(res.data?.error || 'Failed to load subscriptions.'); setLoading(false); }, [page, search, status]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const open = async (id) => { const res = await adminFetch(`/admin/subscriptions/${id}`); if (res.ok) setDetail(res.data); else setError(res.data?.error || 'Could not load subscription.'); };
  const cancel = async () => { if (!detail || !window.confirm('Cancel this subscription and turn off auto-renew?')) return; const res = await adminFetch(`/admin/subscriptions/${detail.subscription.id}/cancel`, { method: 'PATCH', body: {} }); if (!res.ok) return setError(res.data?.error || 'Cancellation failed.'); setDetail(null); load(); };
  return <div><PageTitle title="Subscriptions" description="Real subscription records and invoice history. Manual plan assignment is intentionally unavailable." onRefresh={load}/><Notice error={error}/><div style={{ ...card, padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}><input style={{ ...input, minWidth: 240, flex: 1 }} value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} placeholder="Search user, email, or plan"/><select style={input} value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}><option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select></div><div style={card}>{loading ? <Loading/> : <><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr>{['Customer','Plan','Status','Price','Renewal','Actions'].map(h => <th key={h} style={{ padding: 12, textAlign: 'left', fontSize: '.7rem', color: '#64748B', background: '#F8FAFC' }}>{h}</th>)}</tr></thead><tbody>{data.subscriptions.map(s => <tr key={s.id} style={{ borderTop: '1px solid #EEF2F6' }}><td style={{ padding: 12 }}><b>{s.full_name}</b><div style={{ color: '#64748B', fontSize: '.74rem' }}>{s.email}</div></td><td style={{ padding: 12 }}>{s.display_name}</td><td style={{ padding: 12 }}><Status value={s.status}/></td><td style={{ padding: 12 }}>{money(s.price_at_signup)}</td><td style={{ padding: 12 }}>{fmtDate(s.renews_on)}</td><td style={{ padding: 12 }}><button style={primary} onClick={() => open(s.id)}><Eye size={13} /> View</button></td></tr>)}</tbody></table></div><Pager pagination={data.pagination} onPage={setPage}/></>}</div>{detail && <Modal title="Subscription detail" onClose={() => setDetail(null)}><p><b>{detail.subscription.full_name}</b> · {detail.subscription.email}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 18 }}>{[['Plan',detail.subscription.display_name],['Status',detail.subscription.status],['Price',money(detail.subscription.price_at_signup)],['Payment method',detail.subscription.payment_method],['Auto renew',detail.subscription.auto_renew ? 'On' : 'Off'],['Renews',fmtDate(detail.subscription.renews_on)]].map(([k,v])=><div key={k} style={{ padding: 10, background: '#F8FAFC', borderRadius: 8 }}><small style={{ color:'#64748B' }}>{k}</small><div><b>{v}</b></div></div>)}</div><h4>Invoices</h4>{detail.invoices.length ? detail.invoices.map(i=><div key={i.id} style={{ padding: 10, borderTop: '1px solid #E2E8F0', display:'flex', justifyContent:'space-between' }}><span>{i.invoice_number} · {i.plan_name}</span><span>{money(i.amount)} · <Status value={i.status}/></span></div>) : <p>No invoice records.</p>}{['active','pending'].includes(detail.subscription.status) && <button style={{ ...button, marginTop: 16, borderColor: '#FECACA', color: '#B42318' }} onClick={cancel}>Cancel subscription</button>}</Modal>}</div>;
}

export function AdminPlansPage() {
  const [plans,setPlans]=useState([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [editing,setEditing]=useState(null);
  const load=useCallback(async()=>{setLoading(true);const res=await adminFetch('/admin/plans');if(res.ok)setPlans(res.data.plans||[]);else setError(res.data?.error||'Failed to load plans.');setLoading(false);},[]);useEffect(()=>{load();},[load]);
  const save=async()=>{const body={displayName:editing.display_name,priceInr:Number(editing.price_inr),billingCycle:editing.billing_cycle,features:editing.features||[],isActive:editing.is_active,sortOrder:Number(editing.sort_order)};const res=await adminFetch(`/admin/plans/${editing.id}`,{method:'PATCH',body});if(!res.ok)return setError(res.data?.error||'Could not save plan.');setEditing(null);load();};
  return <div><PageTitle title="Plans" description="Editable commercial fields only. Enum plan identifiers are displayed but never editable." onRefresh={load}/><Notice error={error}/><div style={card}>{loading?<Loading/>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:760}}><thead><tr>{['Identifier','Display name','Price','Cycle','Active users','Availability',''].map(h=><th key={h} style={{padding:12,textAlign:'left',fontSize:'.7rem',color:'#64748B',background:'#F8FAFC'}}>{h}</th>)}</tr></thead><tbody>{plans.map(p=><tr key={p.id} style={{borderTop:'1px solid #EEF2F6'}}><td style={{padding:12}}><b>{p.name}</b></td><td style={{padding:12}}>{p.display_name}</td><td style={{padding:12}}>{money(p.price_inr)}</td><td style={{padding:12}}>{p.billing_cycle}</td><td style={{padding:12}}>{p.active_subscriptions}</td><td style={{padding:12}}><Status value={p.is_active?'active':'inactive'}/></td><td style={{padding:12}}><button style={button} onClick={()=>setEditing({...p,features:p.features||[]})}>Edit</button></td></tr>)}</tbody></table></div>}</div>{editing&&<Modal title={`Edit ${editing.name}`} onClose={()=>setEditing(null)}><p style={{fontSize:'.8rem',color:'#64748B'}}>The identifier is immutable because it is a PostgreSQL enum value.</p><div style={{display:'grid',gap:12}}><label>Display name<input style={{...input,width:'100%',boxSizing:'border-box'}} value={editing.display_name} onChange={e=>setEditing({...editing,display_name:e.target.value})}/></label><label>Price (INR)<input type="number" min="0" style={{...input,width:'100%',boxSizing:'border-box'}} value={editing.price_inr} onChange={e=>setEditing({...editing,price_inr:e.target.value})}/></label><label>Billing cycle<input style={{...input,width:'100%',boxSizing:'border-box'}} value={editing.billing_cycle} onChange={e=>setEditing({...editing,billing_cycle:e.target.value})}/></label><label>Features (one per line)<textarea rows="5" style={{...input,width:'100%',boxSizing:'border-box'}} value={(editing.features||[]).join('\n')} onChange={e=>setEditing({...editing,features:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)})}/></label><label><input type="checkbox" checked={editing.is_active} onChange={e=>setEditing({...editing,is_active:e.target.checked})}/> Available for new subscriptions</label><button style={primary} onClick={save}><Save size={14}/> Save changes</button></div></Modal>}</div>;
}

export function AdminPaymentsPage() {
  const [data,setData]=useState({payments:[],pagination:null});const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [page,setPage]=useState(1);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [detail,setDetail]=useState(null);
  const load=useCallback(async()=>{setLoading(true);const q=new URLSearchParams({page,pageSize:25});if(search)q.set('search',search);if(status)q.set('status',status);const res=await adminFetch(`/admin/payments?${q}`);if(res.ok)setData(res.data);else setError(res.data?.error||'Failed to load payments.');setLoading(false);},[page,search,status]);useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t);},[load]);
  return <div><PageTitle title="Payments & invoices" description="Read-only billing history. No payment credentials, capture, refund, or settlement controls exist in this backend." onRefresh={load}/><Notice error={error}/><div style={{...card,padding:14,marginBottom:16,display:'flex',gap:10}}><input style={{...input,flex:1}} value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search customer, plan, or invoice"/><select style={input} value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">All statuses</option><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option></select></div><div style={card}>{loading?<Loading/>:<><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:720}}><thead><tr>{['Invoice','Customer','Plan','Amount','Status','Date',''].map(h=><th key={h} style={{padding:12,textAlign:'left',fontSize:'.7rem',color:'#64748B',background:'#F8FAFC'}}>{h}</th>)}</tr></thead><tbody>{data.payments.map(p=><tr key={p.id} style={{borderTop:'1px solid #EEF2F6'}}><td style={{padding:12}}>{p.invoice_number}</td><td style={{padding:12}}><b>{p.full_name}</b><div style={{fontSize:'.72rem',color:'#64748B'}}>{p.email}</div></td><td style={{padding:12}}>{p.plan_name}</td><td style={{padding:12}}>{money(p.amount)}</td><td style={{padding:12}}><Status value={p.status}/></td><td style={{padding:12}}>{fmtDate(p.billing_date)}</td><td style={{padding:12}}><button style={button} onClick={async()=>{const r=await adminFetch(`/admin/payments/${p.id}`);if(r.ok)setDetail(r.data.payment);else setError(r.data?.error||'Could not load payment.')}}>Detail</button></td></tr>)}</tbody></table></div><Pager pagination={data.pagination} onPage={setPage}/></>}</div>{detail&&<Modal title="Payment record" onClose={()=>setDetail(null)}><div style={{display:'grid',gap:10}}>{[['Invoice',detail.invoice_number],['Customer',`${detail.full_name} (${detail.email})`],['Plan',detail.plan_name],['Amount',money(detail.amount)],['Status',detail.status],['Billing date',fmtDate(detail.billing_date)],['Payment method',detail.payment_method||'—']].map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid #EEF2F6',paddingBottom:8}}><span style={{color:'#64748B'}}>{k}</span><b>{v}</b></div>)}</div></Modal>}</div>;
}

export function AdminCrmPage() {
  const [data,setData]=useState({leads:[],pagination:null});const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [page,setPage]=useState(1);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [detail,setDetail]=useState(null);
  const load=useCallback(async()=>{setLoading(true);const q=new URLSearchParams({page,pageSize:25});if(search)q.set('search',search);if(status)q.set('status',status);const res=await adminFetch(`/admin/leads?${q}`);if(res.ok)setData(res.data);else setError(res.data?.error||'Failed to load leads.');setLoading(false);},[page,search,status]);useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t);},[load]);
  const open=async(id)=>{const r=await adminFetch(`/admin/leads/${id}`);if(r.ok)setDetail(r.data);else setError(r.data?.error||'Could not load lead.');};const save=async()=>{const r=await adminFetch(`/admin/leads/${detail.lead.id}`,{method:'PATCH',body:{status:detail.lead.status,leadScore:detail.lead.lead_score,notes:detail.lead.notes||null,nextFollowupDate:detail.lead.next_followup_date||null}});if(!r.ok)return setError(r.data?.error||'Could not save lead.');setDetail(null);load();};
  return <div><PageTitle title="CRM leads" description="Real leads, follow-ups, activities, and notes from the existing CRM tables." onRefresh={load}/><Notice error={error}/><div style={{...card,padding:14,marginBottom:16,display:'flex',gap:10}}><input style={{...input,flex:1}} value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search company, contact, or email"/><select style={input} value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">All stages</option>{['New','Called','Connected','Interested','Converted','Lost'].map(x=><option key={x}>{x}</option>)}</select></div><div style={card}>{loading?<Loading/>:<><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:780}}><thead><tr>{['Company / contact','Stage','Score','Owner','Open follow-ups',''].map(h=><th key={h} style={{padding:12,textAlign:'left',fontSize:'.7rem',color:'#64748B',background:'#F8FAFC'}}>{h}</th>)}</tr></thead><tbody>{data.leads.map(l=><tr key={l.id} style={{borderTop:'1px solid #EEF2F6'}}><td style={{padding:12}}><b>{l.company_name}</b><div style={{fontSize:'.72rem',color:'#64748B'}}>{l.contact_name} · {l.email||l.mobile}</div></td><td style={{padding:12}}><Status value={l.status}/></td><td style={{padding:12}}>{l.lead_score}</td><td style={{padding:12}}>{l.assigned_executive_name||'Unassigned'}</td><td style={{padding:12}}>{l.open_followups}</td><td style={{padding:12}}><button style={primary} onClick={()=>open(l.id)}>View</button></td></tr>)}</tbody></table></div><Pager pagination={data.pagination} onPage={setPage}/></>}</div>{detail&&<Modal title="Lead detail" onClose={()=>setDetail(null)}><div style={{display:'grid',gap:12}}><p style={{margin:0}}><b>{detail.lead.company_name}</b><br/><span style={{color:'#64748B'}}>{detail.lead.contact_name} · {detail.lead.email||detail.lead.mobile}</span></p><div style={{display:'flex',gap:10}}><label style={{flex:1}}>Stage<select style={{...input,width:'100%'}} value={detail.lead.status} onChange={e=>setDetail({...detail,lead:{...detail.lead,status:e.target.value}})}>{['New','Called','Connected','Interested','Converted','Lost'].map(x=><option key={x}>{x}</option>)}</select></label><label style={{flex:1}}>Score<select style={{...input,width:'100%'}} value={detail.lead.lead_score} onChange={e=>setDetail({...detail,lead:{...detail.lead,lead_score:e.target.value}})}>{['HOT','WARM','COLD'].map(x=><option key={x}>{x}</option>)}</select></label></div><label>Next follow-up<input type="date" style={{...input,width:'100%',boxSizing:'border-box'}} value={detail.lead.next_followup_date||''} onChange={e=>setDetail({...detail,lead:{...detail.lead,next_followup_date:e.target.value||null}})}/></label><label>Internal lead notes<textarea rows="4" style={{...input,width:'100%',boxSizing:'border-box'}} value={detail.lead.notes||''} onChange={e=>setDetail({...detail,lead:{...detail.lead,notes:e.target.value}})}/></label><button style={primary} onClick={save}><Save size={14}/> Save lead</button><h4 style={{marginBottom:0}}>Follow-ups</h4>{detail.followups.length?detail.followups.map(f=><div key={f.id} style={{padding:9,borderTop:'1px solid #EEF2F6'}}>{f.followup_date} · {f.followup_type} · {f.completed?'Completed':'Open'} {f.notes?`— ${f.notes}`:''}</div>):<small>No follow-ups recorded.</small>}<h4 style={{marginBottom:0}}>Activity</h4>{detail.activities.length?detail.activities.map((a,i)=><div key={i} style={{padding:9,borderTop:'1px solid #EEF2F6'}}>{a.activity}<small style={{display:'block',color:'#64748B'}}>{fmtDate(a.created_at)}</small></div>):<small>No activity recorded.</small>}</div></Modal>}</div>;
}

export function AdminReportsPage() { const [data,setData]=useState(null);const [error,setError]=useState('');const load=useCallback(async()=>{const r=await adminFetch('/admin/reports');if(r.ok&&r.data)setData(r.data);else setError(r.data?.error||'Failed to load reports.');},[]);useEffect(()=>{load();},[load]);if(!data)return <><PageTitle title="Reports" description="Server-side totals from real users, subscriptions, invoices, and session activity." onRefresh={load}/><Notice error={error}/><Loading/></>;return <div><PageTitle title="Reports" description="Server-side totals from real users, subscriptions, invoices, and session activity." onRefresh={load}/><Notice error={error}/><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:20}}>{[['Users',data.users?.total ?? 0],['Active subscriptions',data.subscriptions?.active ?? 0],['Paid revenue',money(data.revenue?.paid_total ?? 0)],['Paid last 30d',money(data.revenue?.paid_30d ?? 0)]].map(([k,v])=><div key={k} style={{...card,padding:18}}><small style={{color:'#64748B'}}>{k}</small><div style={{fontSize:'1.4rem',fontWeight:800}}>{v}</div></div>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}><div style={{...card,padding:18}}><h3 style={{marginTop:0,fontSize:'.95rem'}}>Plan distribution</h3>{(data.planDistribution||[]).map(p=><div key={p.name} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderTop:'1px solid #EEF2F6'}}><span>{p.display_name}</span><b>{p.active_subscriptions}</b></div>)}</div><div style={{...card,padding:18}}><h3 style={{marginTop:0,fontSize:'.95rem'}}>Recent activity</h3>{(data.recentActivity||[]).map((a,i)=><div key={i} style={{padding:'9px 0',borderTop:'1px solid #EEF2F6'}}><b>{a.type}</b> · {a.full_name}<small style={{display:'block',color:'#64748B'}}>{a.email} · {fmtDate(a.created_at)}</small></div>)}</div></div></div>; }

export function AdminAuditLogsPage() { const [data,setData]=useState({logs:[],pagination:null});const [page,setPage]=useState(1);const [action,setAction]=useState('');const [entityType,setEntityType]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const load=useCallback(async()=>{setLoading(true);const q=new URLSearchParams({page,pageSize:25});if(action)q.set('action',action);if(entityType)q.set('entityType',entityType);const r=await adminFetch(`/admin/audit-logs?${q}`);if(r.ok)setData(r.data);else setError(r.data?.error||'Failed to load audit logs.');setLoading(false);},[page,action,entityType]);useEffect(()=>{load();},[load]);return <div><PageTitle title="Audit logs" description="Administrative mutations only. Successful admin sign-ins are retained separately as secure session records; failed-login events are not modeled by the current backend." onRefresh={load}/><Notice error={error}/><div style={{...card,padding:14,marginBottom:16,display:'flex',gap:10,flexWrap:'wrap'}}><input style={{...input,flex:1,minWidth:220}} value={action} onChange={e=>{setPage(1);setAction(e.target.value)}} placeholder="Filter action, e.g. plan.updated"/><input style={{...input,minWidth:180}} value={entityType} onChange={e=>{setPage(1);setEntityType(e.target.value)}} placeholder="Filter entity type"/></div><div style={card}>{loading?<Loading/>:<><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:720}}><thead><tr>{['When','Admin','Action','Entity','Details'].map(h=><th key={h} style={{padding:12,textAlign:'left',fontSize:'.7rem',color:'#64748B',background:'#F8FAFC'}}>{h}</th>)}</tr></thead><tbody>{data.logs.length===0?<tr><td colSpan={5} style={{padding:40,textAlign:'center',color:'#94A3B8'}}>No audit events found.</td></tr>:data.logs.map(l=><tr key={l.id} style={{borderTop:'1px solid #EEF2F6'}}><td style={{padding:12}}>{fmtDate(l.created_at)}</td><td style={{padding:12}}>{l.display_name||l.username||'Deleted admin'}</td><td style={{padding:12}}><b>{l.action}</b></td><td style={{padding:12}}>{l.entity_type}</td><td style={{padding:12,fontSize:'.74rem',color:'#64748B'}}>{Object.keys(l.metadata||{}).join(', ')||'—'}</td></tr>)}</tbody></table></div><Pager pagination={data.pagination} onPage={setPage}/></>}</div></div>; }

export function AdminNotificationsPage() { const [data,setData]=useState({notifications:[],pagination:null});const [unread,setUnread]=useState(false);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const load=useCallback(async()=>{setLoading(true);const q=new URLSearchParams({page:1,pageSize:50});if(unread)q.set('unread','true');const r=await adminFetch(`/admin/notifications?${q}`);if(r.ok)setData(r.data);else setError(r.data?.error||'Failed to load notifications.');setLoading(false);},[unread]);useEffect(()=>{load();},[load]);const markRead=async(id)=>{const r=await adminFetch(`/admin/notifications/${id}/read`,{method:'PATCH',body:{}});if(r.ok)setData(p=>({...p,notifications:p.notifications.map(n=>n.id===id?{...n,is_read:true}:n)}));else setError(r.data?.error||'Could not mark notification read.');};return <div><PageTitle title="Notifications" description="Registrations, payments, and system events from PostgreSQL." onRefresh={load}/><Notice error={error}/><label style={{display:'inline-flex',gap:8,alignItems:'center',marginBottom:16,fontSize:'.82rem'}}><input type="checkbox" checked={unread} onChange={e=>setUnread(e.target.checked)}/> Unread only</label><div style={card}>{loading?<Loading/>:data.notifications.length===0?<Loading>No notifications found.</Loading>:data.notifications.map(n=><div key={n.id} style={{padding:14,borderBottom:'1px solid #EEF2F6',display:'flex',justifyContent:'space-between',gap:12,opacity:n.is_read?.6:1}}><div><b>{n.title}</b><div style={{fontSize:'.82rem',color:'#64748B',marginTop:4}}>{n.message}</div><small style={{color:'#94A3B8'}}>{fmtDate(n.created_at)}</small></div>{!n.is_read&&<button style={button} onClick={()=>markRead(n.id)}>Mark read</button>}</div>)}</div></div>; }

export function AdminRevenueAnalyticsPage() { const [data,setData]=useState(null);const [range,setRange]=useState('30d');const [error,setError]=useState('');const load=useCallback(async()=>{const r=await adminFetch(`/admin/revenue-analytics?range=${range}`);if(r.ok)setData(r.data);else setError(r.data?.error||'Failed to load revenue analytics.');},[range]);useEffect(()=>{load();},[load]);return <div><PageTitle title="Revenue analytics" description="Revenue and conversion metrics computed from billing_history and subscriptions." onRefresh={load}/><Notice error={error}/><div style={{display:'flex',gap:8,marginBottom:16}}>{['today','7d','30d'].map(x=><button key={x} style={{...button,background:range===x?'#214ECF':'#FFFFFF',color:range===x?'#FFFFFF':'#172033'}} onClick={()=>setRange(x)}>{x}</button>)}</div>{!data?<Loading/>:<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:20}}><div style={{...card,padding:18}}><small>Active subscriptions</small><h3>{data.activeSubscriptions}</h3></div><div style={{...card,padding:18}}><small>Trial to paid conversion</small><h3>{data.trialToPaidConversion}%</h3></div></div><div style={{...card,padding:18}}><h3 style={{marginTop:0}}>Monthly revenue</h3>{data.monthly.length===0?<p style={{color:'#94A3B8'}}>No paid revenue in this range.</p>:data.monthly.map(row=><div key={row.period} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderTop:'1px solid #EEF2F6'}}><span>{row.period}</span><b>{money(row.revenue)}</b></div>)}</div></>}</div>; }

// ============================================================================
// AdminQuantSubscriptionsPage
// Manages the new quant subscription system (user_subscriptions table).
// Separate from the legacy AdminSubscriptionsPage which uses the old
// subscriptions / billing_history tables.
// ============================================================================

const PLAN_COLORS = { TRIAL: '#2456d7', BASIC: '#0891b2', PRO: '#7c3aed', ELITE: '#b45309' };
const STATUS_LABELS = {
  trial:     { label: 'Trial',     bg: '#eff6ff', color: '#1d4ed8' },
  active:    { label: 'Active',    bg: '#f0fdf4', color: '#15803d' },
  expired:   { label: 'Expired',   bg: '#fff7ed', color: '#c2410c' },
  cancelled: { label: 'Cancelled', bg: '#fef2f2', color: '#b91c1c' },
  suspended: { label: 'Suspended', bg: '#fdf4ff', color: '#7e22ce' },
};

function QuantSubStatus({ value }) {
  const cfg = STATUS_LABELS[value] || { label: value || '—', bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 6,
      fontSize: '.7rem', fontWeight: 800,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

function PlanBadge({ code }) {
  const color = PLAN_COLORS[code] || '#64748b';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 6,
      fontSize: '.7rem', fontWeight: 800,
      background: color + '18', color,
      border: `1px solid ${color}44`,
    }}>
      {code || '—'}
    </span>
  );
}

export function AdminQuantSubscriptionsPage() {
  const [data, setData]           = useState({ subscriptions: [], pagination: null });
  const [stats, setStats]         = useState(null);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [planFilter, setPlan]     = useState('');
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [detail, setDetail]       = useState(null);      // { subscription, auditLog, payments }
  const [actionErr, setActionErr] = useState('');
  const [actionOk, setActionOk]   = useState('');
  const [extendDays, setExtendDays] = useState(7);
  const [suspendReason, setSuspendReason] = useState('');

  const loadStats = useCallback(async () => {
    const res = await adminFetch('/admin/quant-subscriptions/stats');
    if (res.ok) setStats(res.data.stats);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page, pageSize: 25 });
    if (search)       qs.set('search',   search);
    if (statusFilter) qs.set('status',   statusFilter);
    if (planFilter)   qs.set('planCode', planFilter);
    const res = await adminFetch(`/admin/quant-subscriptions?${qs}`);
    if (res.ok) setData(res.data);
    else setError(res.data?.error || 'Failed to load subscriptions.');
    setLoading(false);
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openDetail = async (userId) => {
    setActionErr(''); setActionOk('');
    const res = await adminFetch(`/admin/quant-subscriptions/user/${userId}`);
    if (res.ok) setDetail(res.data);
    else setError(res.data?.error || 'Could not load subscription detail.');
  };

  const changePlan = async (userId, planCode) => {
    setActionErr(''); setActionOk('');
    const res = await adminFetch(`/admin/quant-subscriptions/user/${userId}/plan`, {
      method: 'PATCH', body: { planCode },
    });
    if (res.ok) { setActionOk(`Plan changed to ${planCode}.`); await openDetail(userId); load(); }
    else setActionErr(res.data?.error || 'Plan change failed.');
  };

  const extendTrial = async (userId) => {
    setActionErr(''); setActionOk('');
    const days = Number(extendDays);
    if (!days || days < 1) return setActionErr('Enter a valid number of days.');
    const res = await adminFetch(`/admin/quant-subscriptions/user/${userId}/extend-trial`, {
      method: 'PATCH', body: { extraDays: days },
    });
    if (res.ok) { setActionOk(`Trial extended by ${days} day(s).`); await openDetail(userId); load(); }
    else setActionErr(res.data?.error || 'Could not extend trial.');
  };

  const suspend = async (userId) => {
    setActionErr(''); setActionOk('');
    if (!suspendReason.trim()) return setActionErr('A suspension reason is required.');
    const res = await adminFetch(`/admin/quant-subscriptions/user/${userId}/suspend`, {
      method: 'PATCH', body: { reason: suspendReason.trim() },
    });
    if (res.ok) { setActionOk('Subscription suspended.'); setSuspendReason(''); await openDetail(userId); load(); }
    else setActionErr(res.data?.error || 'Could not suspend.');
  };

  const unsuspend = async (userId) => {
    setActionErr(''); setActionOk('');
    const res = await adminFetch(`/admin/quant-subscriptions/user/${userId}/unsuspend`, {
      method: 'PATCH', body: {},
    });
    if (res.ok) { setActionOk('Subscription reactivated.'); await openDetail(userId); load(); }
    else setActionErr(res.data?.error || 'Could not unsuspend.');
  };

  return (
    <div>
      <PageTitle
        title="Quant Subscriptions"
        description="Manage KEPWE Quant trial and paid subscriptions. All admin actions are fully audited."
        onRefresh={() => { load(); loadStats(); }}
      />
      <Notice error={error} />

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            ['Active Trials',  stats.active_trials,  '#2456d7'],
            ['Expired Trials', stats.expired_trials,  '#c2410c'],
            ['Active Paid',    stats.active_paid,     '#15803d'],
            ['Cancelled',      stats.cancelled,       '#9a3412'],
            ['Suspended',      stats.suspended,       '#7e22ce'],
            ['Total',          stats.total,           '#475569'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ fontSize: '.68rem', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ ...card, padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200 }}
          value={search}
          onChange={e => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search user name or email…"
        />
        <select style={input} value={statusFilter} onChange={e => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active (Paid)</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
          <option value="suspended">Suspended</option>
        </select>
        <select style={input} value={planFilter} onChange={e => { setPage(1); setPlan(e.target.value); }}>
          <option value="">All plans</option>
          <option value="TRIAL">Free Trial</option>
          <option value="BASIC">Basic</option>
          <option value="PRO">Pro</option>
          <option value="ELITE">Elite</option>
        </select>
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? <Loading /> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr>
                    {['User', 'Plan', 'Status', 'Trial Start', 'Trial End', 'Sub End', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '.7rem', color: '#64748b', background: '#f8fafc', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No records found.</td></tr>
                  ) : data.subscriptions.map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: '.86rem', color: '#172033' }}>{s.full_name}</div>
                        <div style={{ fontSize: '.72rem', color: '#64748b' }}>{s.email}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}><PlanBadge code={s.plan_code} /></td>
                      <td style={{ padding: '10px 14px' }}><QuantSubStatus value={s.status} /></td>
                      <td style={{ padding: '10px 14px', fontSize: '.78rem', color: '#64748b' }}>{fmtDate(s.trial_start_at)}</td>
                      <td style={{ padding: '10px 14px', fontSize: '.78rem', color: s.trial_end_at && new Date(s.trial_end_at) < new Date() ? '#c2410c' : '#64748b' }}>{fmtDate(s.trial_end_at)}</td>
                      <td style={{ padding: '10px 14px', fontSize: '.78rem', color: '#64748b' }}>{fmtDate(s.subscription_end_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button style={primary} onClick={() => openDetail(s.user_id)}>
                          <Eye size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager pagination={data.pagination} onPage={setPage} />
          </>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <Modal title={`Subscription — ${detail.subscription?.full_name || ''}`} onClose={() => setDetail(null)}>
          {actionOk && (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '.82rem', fontWeight: 600 }}>
              ✓ {actionOk}
            </div>
          )}
          {actionErr && (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '.82rem' }}>
              {actionErr}
            </div>
          )}

          {/* Summary grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              ['Name',         detail.subscription?.full_name],
              ['Email',        detail.subscription?.email],
              ['Plan',         detail.subscription?.plan_code],
              ['Status',       detail.subscription?.status],
              ['Trial Start',  fmtDate(detail.subscription?.trial_start_at)],
              ['Trial End',    fmtDate(detail.subscription?.trial_end_at)],
              ['Sub Start',    fmtDate(detail.subscription?.subscription_start_at)],
              ['Sub End',      fmtDate(detail.subscription?.subscription_end_at)],
              ['Auto Renew',   detail.subscription?.auto_renew ? 'Yes' : 'No'],
              ['Suspended At', fmtDate(detail.subscription?.suspended_at)],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: '.66rem', color: '#64748b', fontWeight: 700, marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#172033', wordBreak: 'break-all' }}>{v || '—'}</div>
              </div>
            ))}
          </div>

          {/* Admin actions */}
          <div style={{ display: 'grid', gap: 16 }}>

            {/* Change plan */}
            <section style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '.84rem', marginBottom: 10 }}>Change Plan</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['TRIAL', 'BASIC', 'PRO', 'ELITE'].map(code => (
                  <button
                    key={code}
                    style={{ ...button, background: detail.subscription?.plan_code === code ? '#214ecf' : '#fff', color: detail.subscription?.plan_code === code ? '#fff' : '#172033' }}
                    onClick={() => changePlan(detail.subscription.user_id, code)}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </section>

            {/* Extend trial */}
            <section style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '.84rem', marginBottom: 10 }}>Extend Trial</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number" min={1} max={365}
                  value={extendDays}
                  onChange={e => setExtendDays(e.target.value)}
                  style={{ ...input, width: 80 }}
                />
                <span style={{ fontSize: '.82rem', color: '#64748b' }}>days</span>
                <button style={primary} onClick={() => extendTrial(detail.subscription.user_id)}>
                  Extend
                </button>
              </div>
            </section>

            {/* Suspend / Unsuspend */}
            <section style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '.84rem', marginBottom: 10 }}>
                {detail.subscription?.status === 'suspended' ? 'Unsuspend Subscription' : 'Suspend Subscription'}
              </div>
              {detail.subscription?.status === 'suspended' ? (
                <div>
                  <p style={{ fontSize: '.78rem', color: '#64748b', margin: '0 0 10px' }}>
                    Reason: <strong>{detail.subscription?.suspended_reason || '(none recorded)'}</strong>
                  </p>
                  <button style={{ ...primary, background: '#15803d', borderColor: '#15803d' }} onClick={() => unsuspend(detail.subscription.user_id)}>
                    Reactivate Subscription
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...input, flex: 1 }}
                    placeholder="Reason for suspension (required)"
                    value={suspendReason}
                    onChange={e => setSuspendReason(e.target.value)}
                  />
                  <button style={{ ...button, borderColor: '#fecaca', color: '#b91c1c' }} onClick={() => suspend(detail.subscription.user_id)}>
                    Suspend
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Audit log */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, fontSize: '.84rem', marginBottom: 10 }}>Audit Log</div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {(detail.auditLog || []).length === 0 ? (
                <div style={{ padding: 20, color: '#94a3b8', textAlign: 'center', fontSize: '.78rem' }}>No audit events.</div>
              ) : (detail.auditLog || []).map(log => (
                <div key={log.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#172033' }}>{log.event_type}</strong>
                    <span style={{ color: '#94a3b8' }}>{fmtDate(log.created_at)}</span>
                  </div>
                  <div style={{ color: '#475569', marginTop: 3 }}>{log.event_description}</div>
                  <div style={{ color: '#94a3b8', marginTop: 2, fontSize: '.7rem' }}>
                    by {log.performed_by}
                    {log.old_plan_code && log.new_plan_code && log.old_plan_code !== log.new_plan_code &&
                      ` · ${log.old_plan_code} → ${log.new_plan_code}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment history */}
          {(detail.payments || []).length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '.84rem', marginBottom: 10 }}>Payment History</div>
              {detail.payments.map(p => (
                <div key={p.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: '.78rem' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>₹{Number(p.amount_inr).toLocaleString('en-IN')}</div>
                    <div style={{ color: '#64748b' }}>{p.razorpay_payment_id || p.razorpay_order_id || p.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <QuantSubStatus value={p.status} />
                    <div style={{ color: '#94a3b8', marginTop: 3 }}>{fmtDate(p.paid_at || p.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
