import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Download, FileText, ImagePlus, MessageCircle, Phone, Plus, Send, Trash2, Wallet } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { AuthImage } from './PlatformRoutes';
import { askConfirm, notify } from '../components/AppFeedback';
import { Btn, Card, Empty, ErrorBox, Field, Loading, Modal, PageHead, Pill, Stat, TableWrap, Td, THead, fmtDate, fmtDateTime, inputCls, inr, num, selectCls, serif, shortInr } from './ui';

// Only the Accounts login changes anything here. The owner sees every figure but does not change them.
const useWrite = () => usePlatform().permissions.includes('finance:write');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => iso(new Date());
const downloadFile = async (path, params, filename) => {
  try {
    const res = await pApi.get(path, { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { notify(errText(err), 'error'); }
};
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const printPayslip = async (id) => {
  const win = window.open('', '_blank'); if (!win) return notify('Allow pop-ups to print the payslip.', 'error');
  try {
    const { data: p } = await pApi.get(`/finance/payroll/${id}/payslip`);
    const row = (k, v, bold) => `<tr><td>${esc(k)}</td><td class="r${bold ? ' b' : ''}">${esc(v)}</td></tr>`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(p.employee.name)} ${esc(p.month)}</title><style>
      body{font:14px/1.5 Arial,sans-serif;color:#1F2433;margin:40px;max-width:720px}h1{font-size:22px;margin:0}.muted{color:#5B6070}table{width:100%;border-collapse:collapse;margin-top:14px}td{padding:8px 0;border-bottom:1px solid #E2DDD1}.r{text-align:right}.b{font-weight:700}
      .head{display:flex;justify-content:space-between;margin-bottom:22px}</style></head><body>
      <div class="head"><div><h1>${esc(p.company.name)}</h1><div class="muted">${esc(p.company.address)}</div></div><div class="r"><h1>PAYSLIP</h1><div>${esc(monthLabel(p.month))}</div></div></div>
      <div><b>${esc(p.employee.name)}</b>${p.employee.designation ? ` · ${esc(p.employee.designation)}` : ''}</div>${p.employee.joined_on ? `<div class="muted">Joined ${esc(p.employee.joined_on)}</div>` : ''}
      <table>${row('Monthly salary', inr(p.base))}${p.additions ? row('Additions', `+ ${inr(p.additions)}`) : ''}${p.deductions ? row('Deductions', `− ${inr(p.deductions)}`) : ''}${p.note ? `<tr><td colspan="2" class="muted">${esc(p.note)}</td></tr>` : ''}${row('Net salary', inr(p.net), true)}</table>
      ${p.payments.length ? `<p><b>Paid</b></p><table>${p.payments.map((x) => row(`${x.date} · ${x.mode}${x.reference ? ` · ${x.reference}` : ''}`, inr(x.amount))).join('')}${row('Balance still to pay', inr(p.balance), true)}</table>` : '<p class="muted">No payment recorded yet.</p>'}
      <p class="muted" style="margin-top:30px">This is a computer-generated payslip.</p><script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  } catch (err) { win.close(); notify(errText(err), 'error'); }
};
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const statusTone = { Draft: 'gray', Approved: 'amber', Paid: 'green', Pending: 'amber', Kept: 'green', Cancelled: 'gray' };

const SectionTitle = ({ children, right }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3"><h2 style={serif} className="text-[20px] font-medium text-[#1F2433]">{children}</h2>{right}</div>
);

// ---------------------------------------------------------------- shared pop-ups
const PaymentModal = ({ invoice, onClose, onDone }) => {
  const [f, setF] = useState({ amount: String(invoice.outstanding), date: today(), method: 'Bank transfer', reference: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post(`/finance/invoices/${invoice.id}/payments`, { ...f, amount: Number(f.amount) }); notify(Number(f.amount) >= invoice.outstanding ? 'Paid in full' : 'Part payment saved', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Money received: ${invoice.number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-[#FAF8F3] px-3 py-2 text-[13.5px] text-[#4A4F5C]">{invoice.school_name} · total {inr(invoice.total)} · already received {inr(invoice.paid_amount)} · <b>balance {inr(invoice.outstanding)}</b></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount received (₹)" hint="Less than the balance is saved as a part payment."><input type="number" min="1" step="0.01" max={invoice.outstanding} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
          <Field label="Received on"><input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
          <Field label="How"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={inputCls}>{['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Other'].map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Reference (UTR, cheque no.)"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Save payment</Btn></div>
      </form>
    </Modal>
  );
};

const PromiseModal = ({ invoice, onClose, onDone }) => {
  const [f, setF] = useState({ promised_by_name: '', promised_by_role: 'Principal', promised_by_phone: '', promised_on: '', follow_up_on: '', amount: String(invoice.outstanding), note: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post('/finance/promises', { ...f, invoice_id: invoice.id, amount: Number(f.amount) }); notify('Promise noted. You will see it on the day to chase.', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Note what the school promised" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-[#FAF8F3] px-3 py-2 text-[13.5px] text-[#4A4F5C]">{invoice.school_name} · {invoice.number} · {invoice.product} · balance <b>{inr(invoice.outstanding)}</b></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Who promised"><input autoFocus value={f.promised_by_name} onChange={set('promised_by_name')} placeholder="Name" className={inputCls} /></Field>
          <Field label="Their role"><input value={f.promised_by_role} onChange={set('promised_by_role')} placeholder="Chairman, Principal, Accountant" className={inputCls} /></Field>
          <Field label="They will pay on" hint="The date they said."><input type="date" min={today()} value={f.promised_on} onChange={set('promised_on')} className={inputCls} /></Field>
          <Field label="Amount they promised (₹)"><input type="number" min="1" max={invoice.outstanding} step="0.01" value={f.amount} onChange={set('amount')} className={inputCls} /></Field>
          <Field label="Chase me from (optional)" hint="Default is the promised date. Pick earlier to remind them in advance."><input type="date" min={today()} max={f.promised_on || undefined} value={f.follow_up_on} onChange={set('follow_up_on')} className={inputCls} /></Field>
          <Field label="Their phone (optional)"><input value={f.promised_by_phone} onChange={set('promised_by_phone')} className={inputCls} /></Field>
        </div>
        <Field label="What exactly did they say"><textarea rows={2} value={f.note} onChange={set('note')} className={`${inputCls} h-auto py-2`} placeholder="e.g. Will pay after the trust meeting on the 15th" /></Field>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Save promise</Btn></div>
      </form>
    </Modal>
  );
};

const PromiseDetail = ({ promise, invoice, onClose, onDone, write }) => {
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('Spoke to them');
  const [next, setNext] = useState('');
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => { setBusy(true); try { await fn(); notify(ok, 'success'); onDone(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); } };
  const tel = String(promise.promised_by_phone || '').replace(/\D/g, '');
  return (
    <Modal title={`${promise.school_name}: promise`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAF8F3] p-4 text-[14px]">
          <Pill tone={statusTone[promise.status]}>{promise.status}</Pill>
          <span><b>{promise.promised_by_name}</b>{promise.promised_by_role ? ` (${promise.promised_by_role})` : ''} promised <b>{inr(promise.amount)}</b> on <b>{fmtDate(promise.promised_on)}</b></span>
          {promise.overdue && <Pill tone="red">Date passed</Pill>}
          {tel && <a href={`tel:${tel}`} className="ml-auto inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#2E2A6E]"><Phone className="h-4 w-4" />{promise.promised_by_phone}</a>}
        </div>
        {promise.note && <p className="text-[14px] text-[#4A4F5C]">“{promise.note}”</p>}
        {write && promise.status === 'Pending' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-[#E2DDD1] p-4">
              <p className="text-[13px] font-semibold text-[#1F2433]">Log a call or visit</p>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls} aria-label="Outcome">{['Spoke to them', 'No answer', 'Cheque ready', 'Payment processing', 'Asked for more time', 'Disputed the amount'].map((o) => <option key={o}>{o}</option>)}</select>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said" className={`${inputCls} h-auto py-2`} />
              <Field label="Chase again on"><input type="date" min={today()} value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></Field>
              <Btn busy={busy} onClick={() => run(async () => { await pApi.post(`/finance/promises/${promise.id}/followups`, { note, outcome, follow_up_on: next }); setNote(''); }, 'Follow-up saved')}>Save follow-up</Btn>
            </div>
            <div className="space-y-3 rounded-xl border border-[#E2DDD1] p-4">
              <p className="text-[13px] font-semibold text-[#1F2433]">They gave a new date</p>
              <Field label="New promised date"><input type="date" min={today()} value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputCls} /></Field>
              <Btn variant="ghost" busy={busy} disabled={!newDate} onClick={() => run(async () => { await pApi.put(`/finance/promises/${promise.id}`, { promised_on: newDate, note }); setNewDate(''); }, 'New date saved')}>Move the promise</Btn>
              <div className="flex flex-wrap gap-2 border-t border-[#F0ECE2] pt-3">
                {invoice && <Btn variant="ghost" onClick={() => onClose({ pay: invoice })}><Wallet className="h-4 w-4" />Money received</Btn>}
                <button type="button" className="px-2 text-[13px] font-medium text-[#B91C1C] hover:underline" onClick={async () => { if (await askConfirm('Cancel this promise?')) run(() => pApi.put(`/finance/promises/${promise.id}`, { status: 'Cancelled' }), 'Promise cancelled'); }}>Cancel promise</button>
              </div>
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-[#1F2433]">What happened so far</p>
          <ul className="space-y-2 text-[13.5px]">
            {[...promise.history.map((h) => ({ at: h.at, by: h.by, text: h.text })), ...promise.followups.map((f) => ({ at: f.at, by: f.by, text: `${f.outcome ? `${f.outcome}. ` : ''}${f.note}` }))].sort((a, b) => (a.at < b.at ? 1 : -1)).map((h, i) => (
              <li key={i} className="rounded-lg bg-[#FAF8F3] px-3 py-2"><span className="text-[#1F2433]">{h.text}</span><span className="block text-[12px] text-[#8A8F9C]">{h.by} · {fmtDateTime(h.at)}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
};

const ProductInvoiceModal = ({ meta, onClose, onDone }) => {
  const [f, setF] = useState({ school_id: '', product: 'robotics', description: '', quantity: '1', rate: '', discount_percent: '0', academic_year: '', note: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const gross = Number(f.quantity || 0) * Number(f.rate || 0);
  const taxable = gross * (1 - Number(f.discount_percent || 0) / 100);
  const total = taxable * (1 + meta.gst_percent / 100);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post('/finance/product-invoices', { ...f, quantity: Number(f.quantity), rate: Number(f.rate), discount_percent: Number(f.discount_percent) }); notify('Invoice raised', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Invoice for another Orison product" onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="School"><select value={f.school_id} onChange={set('school_id')} className={inputCls}><option value="">Choose a school</option>{meta.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Product"><select value={f.product} onChange={set('product')} className={inputCls}>{meta.products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="What is being billed"><input value={f.description} onChange={set('description')} placeholder="e.g. Robotics lab for classes 6 to 8" className={inputCls} /></Field></div>
        <Field label="Quantity"><input type="number" min="1" step="1" value={f.quantity} onChange={set('quantity')} className={inputCls} /></Field>
        <Field label="Price each (₹)"><input type="number" min="1" step="0.01" value={f.rate} onChange={set('rate')} className={inputCls} /></Field>
        <Field label="Discount %"><input type="number" min="0" max="100" step="0.1" value={f.discount_percent} onChange={set('discount_percent')} className={inputCls} /></Field>
        <Field label="Academic year (optional)"><input value={f.academic_year} onChange={set('academic_year')} placeholder="2026-27" className={inputCls} /></Field>
        <div className="rounded-xl bg-[#2E2A6E] px-4 py-3 text-white sm:col-span-2"><p className="text-[12px] text-white/70">Total with {meta.gst_percent}% GST</p><p style={serif} className="text-[24px]">{inr(total)}</p></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Raise invoice</Btn></div>
      </form>
    </Modal>
  );
};

const CreditModal = ({ invoice, onClose, onDone }) => {
  const [f, setF] = useState({ amount: '', reason: '', date: today() });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await pApi.post(`/finance/invoices/${invoice.id}/credit-notes`, { ...f, amount: Number(f.amount) }); notify(`Credit note ${data.credit_note.number} saved`, 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Credit note on ${invoice.number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-[#FAF8F3] px-3 py-2 text-[13.5px] text-[#4A4F5C]">{invoice.school_name} · invoice {inr(invoice.total)} · balance {inr(invoice.outstanding)}. A credit note lowers what the school owes. If the school has already paid, the extra becomes a refund due.</p>
        <Field label="Credit amount (₹)"><input autoFocus type="number" min="1" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
        <Field label="Reason"><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Fewer students than billed, discount agreed later" className={inputCls} /></Field>
        <Field label="Date"><input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Issue credit note</Btn></div>
      </form>
    </Modal>
  );
};

const RefundModal = ({ row, onClose, onDone }) => {
  const [f, setF] = useState({ amount: String(row.refund_due), date: today(), method: 'Bank transfer', reference: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post(`/finance/invoices/${row.id}/refunds`, { ...f, amount: Number(f.amount) }); notify('Refund recorded', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Refund to ${row.school_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-[#FAF8F3] px-3 py-2 text-[13.5px] text-[#4A4F5C]">{row.number} · refund due <b>{inr(row.refund_due)}</b></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount returned (₹)"><input type="number" min="1" step="0.01" max={row.refund_due} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
          <Field label="Returned on"><input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
          <Field label="How"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={inputCls}>{['Bank transfer', 'UPI', 'Cheque', 'Cash'].map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Reference"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Save refund</Btn></div>
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------- the Accounts desk (home)
const ChaseRow = ({ p, onOpen, wa, write }) => (
  <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2DDD1] bg-white px-4 py-3">
    <div className="min-w-0">
      <p className="font-semibold text-[#1F2433]">{p.school_name} <span className="font-normal text-[#6B7080]">· {p.product}</span></p>
      <p className="text-[13px] text-[#5B6070]">{p.promised_by_name}{p.promised_by_role ? ` (${p.promised_by_role})` : ''} promised <b>{inr(p.amount)}</b> by <b className={p.overdue ? 'text-red-700' : ''}>{fmtDate(p.promised_on)}</b>{p.overdue ? ' · date passed' : p.due_today ? ' · today' : ''}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {write && wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#16A34A] px-4 text-[14px] font-medium text-white hover:bg-[#15803D]"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
      <Btn variant={write ? 'primary' : 'ghost'} onClick={() => onOpen(p)}><Phone className="h-4 w-4" />{write ? 'Follow up' : 'View'}</Btn>
    </div>
  </li>
);

const useCollections = () => useFetch('/finance/collections');

const CollectionsModals = ({ data, state, setState, reload, meta, write }) => {
  const findInvoice = (id) => data.items.find((i) => i.id === id);
  return (
    <>
      {state.pay && <PaymentModal invoice={state.pay} onClose={() => setState({})} onDone={reload} />}
      {state.promiseFor && <PromiseModal invoice={state.promiseFor} onClose={() => setState({})} onDone={reload} />}
      {state.detail && data.promises.find((p) => p.id === state.detail.id) && <PromiseDetail write={write} promise={data.promises.find((p) => p.id === state.detail.id)} invoice={findInvoice(state.detail.invoice_id)} onDone={reload} onClose={(next) => setState(next && next.pay ? { pay: next.pay } : {})} />}
      {state.product && meta && <ProductInvoiceModal meta={meta} onClose={() => setState({})} onDone={reload} />}
      {state.credit && <CreditModal invoice={state.credit} onClose={() => setState({})} onDone={reload} />}
      {state.refund && <RefundModal row={state.refund} onClose={() => setState({})} onDone={reload} />}
    </>
  );
};

export const FinanceHome = () => {
  const { data, loading, error, reload } = useCollections();
  const { data: travel } = useFetch('/finance/travel');
  const { data: rem, reload: reloadRem } = useFetch('/finance/reminders');
  const write = useWrite();
  const [state, setState] = useState({});
  const [sending, setSending] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const s = data.summary;
  const noPromise = data.items.filter((i) => i.no_promise);
  const wa = Object.fromEntries((rem?.items || []).map((i) => [i.id, i.whatsapp_url]));
  const emailNow = async () => {
    setSending(true);
    try { const { data: r } = await pApi.post('/finance/reminders/send'); if (r.sent) notify(`Email sent to ${r.recipients.join(', ')}`, 'success'); else notify(r.reason || 'Nothing was sent.', 'error'); reloadRem(); } catch (err) { notify(errText(err), 'error'); } finally { setSending(false); }
  };
  return (
    <>
      <PageHead actions={write ? <Btn variant="ghost" onClick={emailNow} busy={sending}><Send className="h-4 w-4" />Email me this list</Btn> : null} title="Accounts desk" subtitle={s.promises_today + s.promises_overdue > 0 ? `${s.promises_overdue} promise${s.promises_overdue === 1 ? '' : 's'} missed and ${s.promises_today} due today. Start with the list below.` : 'Money owed by schools, what they promised, and the sales team\'s travel.'} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Still to collect" value={shortInr(s.outstanding)} hint={`${s.invoices} open invoices · ERP ${shortInr(s.erp)} · others ${shortInr(s.other)}`} />
        <Stat label="Overdue" value={shortInr(s.overdue)} tone={s.overdue ? 'bad' : 'ink'} hint={`${s.no_promise} overdue with no promise noted`} />
        <Stat label="Received this month" value={shortInr(s.received_this_month)} hint="All products" />
        <Stat label="Travel this month" value={travel ? `${num(travel.totals.km)} km` : '…'} hint={travel ? `${inr(travel.totals.amount)} at ₹${travel.rate} per km` : ''} />
      </div>

      <section className="mt-8">
        <SectionTitle right={<Link to="/platform/finance/collections" className="text-[13px] font-medium text-[#3F3A8C] hover:underline">All collections →</Link>}>Chase today</SectionTitle>
        {data.chase.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>Nothing to chase today.</Empty></div>
          : <ul className="space-y-2.5">{data.chase.map((p) => <ChaseRow key={p.id} p={p} wa={wa[p.id]} write={write} onOpen={(x) => setState({ detail: x })} />)}</ul>}
        {rem && !rem.email_configured && <p className="mt-2 text-[12.5px] text-[#8A8F9C]">WhatsApp opens a ready message to send from your own phone. Automatic emails start once the developer adds the server's email settings (SMTP).</p>}
        {rem?.last_email && <p className="mt-2 text-[12.5px] text-[#8A8F9C]">Last email: {fmtDateTime(rem.last_email.at)} ({rem.last_email.status}).</p>}
      </section>

      {noPromise.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Overdue, and nobody has said when they will pay</SectionTitle>
          <ul className="space-y-2.5">{noPromise.slice(0, 6).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/40 px-4 py-3">
              <p><b className="text-[#1F2433]">{i.school_name}</b> <span className="text-[13px] text-[#5B6070]">· {i.product} · {i.number} · <b>{inr(i.outstanding)}</b> · {i.days_overdue} days late</span></p>
              {write && <Btn variant="ghost" onClick={() => setState({ promiseFor: i })}>Note a promise</Btn>}
            </li>))}</ul>
        </section>
      )}

      {data.upcoming.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Promised in the next 14 days</SectionTitle>
          <ul className="space-y-2.5">{data.upcoming.map((p) => <ChaseRow key={p.id} p={p} wa={wa[p.id]} write={write} onOpen={(x) => setState({ detail: x })} />)}</ul>
        </section>
      )}
      <CollectionsModals data={data} state={state} setState={setState} reload={reload} write={write} />
    </>
  );
};

// ---------------------------------------------------------------- collections
const agingParts = [['not_due', 'Not due yet', '#10B981'], ['d1_30', '1 to 30 days late', '#F59E0B'], ['d31_60', '31 to 60', '#F97316'], ['d61_90', '61 to 90', '#EF4444'], ['d90_plus', 'Over 90', '#991B1B']];

export const CollectionsPage = () => {
  const { data, loading, error, reload } = useCollections();
  const { data: meta } = useFetch('/finance/meta');
  const [state, setState] = useState({});
  const [tab, setTab] = useState('invoices');
  const [filter, setFilter] = useState('');
  const write = useWrite();
  const [pFilter, setPFilter] = useState('Pending');
  const { data: credits, reload: reloadCredits } = useFetch('/finance/credit-notes');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const s = data.summary;
  const total = Math.max(1, s.outstanding);
  const rows = data.items.filter((i) => !filter || (filter === 'erp' ? i.kind === 'erp' : filter === 'other' ? i.kind === 'other' : filter === 'late' ? i.days_overdue > 0 : filter === 'nopromise' ? i.no_promise : true));
  const proms = data.promises.filter((p) => !pFilter || p.status === pFilter).slice().sort((a, b) => (a.promised_on < b.promised_on ? -1 : 1));
  return (
    <>
      <PageHead title="Collections" subtitle="What schools owe for the ERP and other products, and when they said they would pay."
        actions={<><Btn variant="ghost" onClick={() => downloadFile('/finance/gst.csv', { month: today().slice(0, 7) }, `gst-${today().slice(0, 7)}.csv`)}><Download className="h-4 w-4" />GST sheet (this month)</Btn>{write && <Btn variant="ghost" onClick={() => setState({ product: true })}><Plus className="h-4 w-4" />Invoice for another product</Btn>}</>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Still to collect" value={inr(s.outstanding)} hint={`ERP ${shortInr(s.erp)} · others ${shortInr(s.other)}`} />
        <Stat label="Overdue" value={inr(s.overdue)} tone={s.overdue ? 'bad' : 'ink'} hint={`${s.no_promise} with no promise noted`} />
        <Stat label="Received this month" value={inr(s.received_this_month)} />
        <Stat label="Promises" value={`${s.promises_overdue} missed`} tone={s.promises_overdue ? 'bad' : 'ink'} hint={`${s.promises_today} due today`} />
      </div>
      <section className="mt-5 rounded-2xl border border-[#E2DDD1] bg-white p-5" aria-label="How late is the money">
        <p className="mb-3 text-[13px] font-semibold text-[#1F2433]">How late is the money</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-[#F0ECE2]">{agingParts.map(([k, , c]) => <div key={k} style={{ width: `${(s.aging[k] / total) * 100}%`, background: c }} />)}</div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[#5B6070]">{agingParts.map(([k, l, c]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}: <b className="text-[#1F2433]">{shortInr(s.aging[k])}</b></span>)}</div>
      </section>

      {data.refunds_due.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-5" aria-label="Refunds due">
          <p className="mb-2 text-[14px] font-semibold text-amber-900">Money to return to schools: {inr(s.refund_due)}</p>
          <ul className="space-y-2">{data.refunds_due.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 text-[14px]"><span><b>{r.school_name}</b> · {r.number} · credit {inr(r.credit_amount)} after paying {inr(r.paid_amount)}</span>{write && <Btn variant="ghost" onClick={() => setState({ refund: r })}>Record refund of {inr(r.refund_due)}</Btn>}</li>)}</ul>
        </section>
      )}
      <div className="mb-4 mt-7 flex flex-wrap gap-2" role="tablist">
        {[['invoices', `Invoices owing (${data.items.length})`], ['promises', `Promises (${data.promises.length})`], ['credits', `Credit notes and refunds${credits ? ` (${credits.length})` : ''}`]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-1.5 text-[13.5px] font-medium ${tab === k ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}>{l}</button>)}
      </div>

      {tab === 'invoices' ? (<>
        <div className="mb-3"><select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${selectCls} w-56`} aria-label="Filter">{[['', 'All open invoices'], ['late', 'Overdue only'], ['nopromise', 'Overdue, no promise'], ['erp', 'ERP only'], ['other', 'Other products only']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        {rows.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>Nothing owed here.</Empty></div> : (
          <TableWrap>
            <THead cols={['School', 'Product', 'Balance', 'Due', 'Promise', '']} />
            <tbody>{rows.map((i) => (
              <tr key={i.id}>
                <Td className="font-medium">{i.school_name}<div className="text-[12px] font-normal text-[#6B7080]">{i.number}</div></Td>
                <Td>{i.product}</Td>
                <Td className="font-medium">{inr(i.outstanding)}{i.paid_amount > 0 && <div className="text-[12px] font-normal text-[#6B7080]">of {inr(i.total)}</div>}</Td>
                <Td>{fmtDate(i.due_on)}{i.days_overdue > 0 && <div className="text-[12px] font-medium text-red-700">{i.days_overdue} days late</div>}</Td>
                <Td>{i.next_promise ? <button type="button" onClick={() => setState({ detail: { id: i.next_promise.id, invoice_id: i.id } })} className="text-left"><span className={i.next_promise.overdue ? 'font-medium text-red-700' : 'font-medium text-[#1F2433]'}>{fmtDate(i.next_promise.promised_on)}</span><div className="text-[12px] text-[#6B7080]">{i.next_promise.promised_by_name}</div></button> : <span className="text-[13px] text-[#8A8F9C]">{i.no_promise ? <b className="text-red-700">None</b> : '—'}</span>}</Td>
                <Td className="whitespace-nowrap text-right">{write && <><button onClick={() => setState({ pay: i })} className="mr-3 text-[13px] font-medium text-emerald-700 hover:underline">Money received</button><button onClick={() => setState({ promiseFor: i })} className="mr-3 text-[13px] font-medium text-[#3F3A8C] hover:underline">Note promise</button><button onClick={() => setState({ credit: i })} className="mr-3 text-[13px] font-medium text-[#6B7080] hover:underline">Credit note</button><button onClick={async () => { try { const { data: r } = await pApi.post(`/finance/invoices/${i.id}/email`); notify(`Invoice emailed to ${r.sent_to}`, 'success'); } catch (err) { notify(errText(err), 'error'); } }} className="text-[13px] font-medium text-[#6B7080] hover:underline">Email invoice</button></>}</Td>
              </tr>))}</tbody>
          </TableWrap>)}
      </>) : tab === 'credits' ? (<>
        {!credits || credits.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No credit notes or refunds yet. Use "Credit note" on an invoice owing.</Empty></div> : (
          <TableWrap><THead cols={['Date', 'Type', 'Number', 'School', 'Invoice', 'Amount', 'Reason']} /><tbody>{credits.map((x) => (
            <tr key={x.number}><Td>{fmtDate(x.date)}</Td><Td><Pill tone={x.kind === 'Refund' ? 'amber' : 'indigo'}>{x.kind}</Pill></Td><Td className="font-medium">{x.number}</Td><Td>{x.school_name}</Td><Td>{x.invoice}</Td><Td className="font-medium">{inr(x.amount)}</Td><Td className="text-[13px] text-[#5B6070]">{x.reason}</Td></tr>))}</tbody></TableWrap>)}
      </>) : (<>
        <div className="mb-3"><select value={pFilter} onChange={(e) => setPFilter(e.target.value)} className={`${selectCls} w-44`} aria-label="Status"><option value="">All</option>{['Pending', 'Kept', 'Cancelled'].map((x) => <option key={x}>{x}</option>)}</select></div>
        {proms.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No promises here.</Empty></div> : (
          <TableWrap>
            <THead cols={['Promised for', 'School', 'Who', 'Amount', 'Status', 'Last follow-up']} />
            <tbody>{proms.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-[#FAF8F3]" onClick={() => setState({ detail: p })}>
                <Td className="font-medium">{fmtDate(p.promised_on)}<div className="text-[12px] font-normal text-[#6B7080]">{monthLabel(p.month)}</div></Td>
                <Td>{p.school_name}<div className="text-[12px] text-[#6B7080]">{p.invoice_number} · {p.product}</div></Td>
                <Td>{p.promised_by_name}<div className="text-[12px] text-[#6B7080]">{p.promised_by_role}</div></Td>
                <Td className="font-medium">{inr(p.amount)}</Td>
                <Td><Pill tone={p.overdue ? 'red' : statusTone[p.status]}>{p.overdue ? 'Missed' : p.status}</Pill>{p.reschedules ? <div className="text-[12px] text-[#6B7080]">moved {p.reschedules}×</div> : null}</Td>
                <Td className="text-[13px] text-[#5B6070]">{p.followups.length ? fmtDate(p.followups[p.followups.length - 1].at) : '—'}</Td>
              </tr>))}</tbody>
          </TableWrap>)}
      </>)}
      <CollectionsModals data={data} state={state} setState={setState} reload={() => { reload(); reloadCredits(); }} meta={meta} write={write} />
    </>
  );
};

// ---------------------------------------------------------------- travel allowance and expenses
const downloadCsv = async (month) => {
  try {
    const res = await pApi.get('/finance/travel.csv', { params: { month }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `travel-allowance-${month}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { notify(errText(err), 'error'); }
};

const ExpenseModal = ({ meta, people, month, onClose, onDone }) => {
  const [f, setF] = useState({ owner_id: '', date: today(), category: 'Food', amount: '', note: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post('/finance/expenses', { ...f, amount: Number(f.amount) }); notify('Expense added', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add an expense" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Salesperson"><select value={f.owner_id} onChange={set('owner_id')} className={inputCls}><option value="">Choose</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Date"><input type="date" max={today()} value={f.date} onChange={set('date')} className={inputCls} /></Field>
        <Field label="Category"><select value={f.category} onChange={set('category')} className={inputCls}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Amount (₹)"><input type="number" min="1" step="0.01" value={f.amount} onChange={set('amount')} className={inputCls} /></Field>
        <div className="sm:col-span-2"><Field label="Note"><input value={f.note} onChange={set('note')} placeholder="e.g. Lunch on the Warangal trip, bill no. 114" className={inputCls} /></Field></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Add expense</Btn></div>
      </form>
    </Modal>
  );
};

const PayTravelModal = ({ person, month, onClose, onDone }) => {
  const [f, setF] = useState({ paid_on: today(), reference: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post('/finance/travel/paid', { month, owner_id: person.owner_id, ...f }); notify('Marked as paid', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Pay ${person.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-[#FAF8F3] px-3 py-2 text-[14px]">{monthLabel(month)} · {person.statement.km} km × ₹{person.statement.rate} = <b>{inr(person.statement.amount)}</b></p>
        <Field label="Paid on"><input type="date" max={today()} value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} className={inputCls} /></Field>
        <Field label="Reference (UPI, bank, cash)"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={inputCls} /></Field>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Mark paid</Btn></div>
      </form>
    </Modal>
  );
};

export const TravelPage = () => {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [open, setOpen] = useState('');
  const [owner, setOwner] = useState('');
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState(null);
  const { data, loading, error, reload } = useFetch('/finance/travel', { month });
  const { data: meta } = useFetch('/finance/meta');
  const { data: exp, reload: reloadExp } = useFetch('/finance/expenses', { month, owner_id: owner });
  const write = useWrite();
  const approve = async (p) => {
    try { await pApi.post('/finance/travel/approve', { month, owner_id: p.owner_id }); notify(`${p.name}: approved`, 'success'); reload(); } catch (err) { notify(errText(err), 'error'); }
  };
  const removeExpense = async (e) => {
    if (!(await askConfirm('Delete this expense?'))) return;
    try { await pApi.delete(`/finance/expenses/${e.id}`); notify('Deleted', 'success'); reloadExp(); } catch (err) { notify(errText(err), 'error'); }
  };
  return (
    <>
      <PageHead title="Travel and expenses" subtitle="Kilometres from the visits the sales team logs times the rate per km, plus a fixed food allowance for every day on the road. Only Accounts approves and pays. Approving a month locks the figures."
        actions={<><input type="month" value={month} max={today().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" className={`${selectCls} w-44`} /><Btn variant="ghost" onClick={() => downloadCsv(month)}><Download className="h-4 w-4" />Download sheet</Btn></>} />
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (<>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Rates" value={`₹${data.rate}/km`} hint={`plus ₹${data.food_rate} food for every day on the road`} />
          <Stat label="Total km" value={num(data.totals.km)} hint={monthLabel(month)} />
          <Stat label="Travel and food" value={inr(data.totals.amount)} hint={`${inr(data.totals.km_amount)} km + ${inr(data.totals.food_amount)} food`} />
          <Stat label="To check" value={num(data.totals.missing + data.totals.flags + data.totals.away)} tone={data.totals.missing + data.totals.flags + data.totals.away ? 'warn' : 'ink'} hint={`${data.totals.missing} missing, ${data.totals.flags} look wrong, ${data.totals.away} far from the school`} />
        </div>
        <div className="mt-6">
          {data.people.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No travel recorded in {monthLabel(month)}.</Empty></div> : data.people.map((p) => (
            <section key={p.owner_id} className="mb-4 rounded-2xl border border-[#E2DDD1] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div><p style={serif} className="text-[19px] font-medium text-[#1F2433]">{p.name}</p><p className="text-[13px] text-[#5B6070]">{p.days.length} {p.days.length === 1 ? 'day' : 'days'} · {p.schools} {p.schools === 1 ? 'school' : 'schools'} visited</p></div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right"><p className="text-[13px] text-[#5B6070]">{p.status === 'Draft' ? num(p.km) : num(p.statement.km)} km × ₹{p.status === 'Draft' ? data.rate : p.statement.rate} + {p.status === 'Draft' ? p.food_days : p.statement.food_days} {(p.status === 'Draft' ? p.food_days : p.statement.food_days) === 1 ? 'day' : 'days'} food</p><p style={serif} className="text-[22px] text-[#1F2433]">{inr(p.status === 'Draft' ? p.amount : p.statement.amount)}</p></div>
                  <Pill tone={statusTone[p.status]}>{p.status}</Pill>
                  {p.changed_since_approval && <Pill tone="red">Changed after approval</Pill>}
                  {write && p.status !== 'Paid' && <Btn variant={p.status === 'Draft' ? 'primary' : 'ghost'} onClick={() => approve(p)}>{p.status === 'Draft' ? 'Approve' : 'Approve again'}</Btn>}
                  {write && p.status === 'Approved' && <Btn onClick={() => setPaying(p)}>Mark paid</Btn>}
                  <button type="button" onClick={() => setOpen(open === p.owner_id ? '' : p.owner_id)} className="text-[13px] font-medium text-[#3F3A8C] hover:underline">{open === p.owner_id ? 'Hide days' : 'Show days'}</button>
                </div>
              </div>
              {(p.missing > 0 || p.flags > 0 || p.away > 0) && <p className="border-t border-[#F0ECE2] bg-amber-50/60 px-5 py-2 text-[13px] text-amber-900">{p.missing > 0 && `${p.missing} distance(s) missing. `}{p.flags > 0 && `${p.flags} distance(s) look wrong. `}{p.away > 0 && `${p.away} visit(s) were logged far from the school. `}Open the days to see which.</p>}
              {p.status === 'Paid' && p.statement && <p className="border-t border-[#F0ECE2] px-5 py-2 text-[13px] text-emerald-800">Paid on {fmtDate(p.statement.paid_on)}{p.statement.reference ? ` · ${p.statement.reference}` : ''}</p>}
              {open === p.owner_id && (
                <div className="overflow-x-auto border-t border-[#F0ECE2]"><table className="w-full min-w-[640px] text-[13.5px]">
                  <thead><tr className="text-left text-[11.5px] uppercase tracking-wide text-[#6B7080]"><th className="px-5 py-2">Day</th><th>Schools in order</th><th className="text-right">Between schools</th><th className="text-right">Trip home</th><th className="text-right">Total km</th><th className="px-5 text-right">Day total</th></tr></thead>
                  <tbody>{p.days.map((d) => (
                    <tr key={d.date} className="border-t border-[#F6F3EC] align-top"><td className="px-5 py-2.5 font-medium">{dayLabel(d.date)}</td>
                      <td className="py-2.5">{d.schools.join(' → ')}{d.notes.map((n) => <div key={n} className="text-[12px] text-red-700">{n}</div>)}{d.missing > 0 && <div className="text-[12px] text-red-700">{d.missing} distance missing</div>}</td>
                      <td className="text-right">{d.visit_km}</td><td className="text-right">{d.return_km || <span className="text-[#A5A08F]">not logged</span>}</td><td className="text-right">{d.km}</td><td className="px-5 text-right font-semibold">{inr(d.km * data.rate + d.food)}</td></tr>))}</tbody>
                </table></div>
              )}
            </section>))}
        </div>
      </>)}

      <ClaimsReview month={month} onChanged={() => { reloadExp(); }} />
      <section className="mt-9">
        <SectionTitle right={write && meta && <Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add expense</Btn>}>Other expenses</SectionTitle>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {meta && <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Salesperson" className={`${selectCls} w-48`}><option value="">Everyone</option>{meta.salespeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          {exp && <span className="text-[13.5px] text-[#5B6070]">{monthLabel(month)} total <b className="text-[#1F2433]">{inr(exp.total)}</b>{Object.entries(exp.by_category).map(([k, v]) => <span key={k}> · {k} {inr(v)}</span>)}</span>}
        </div>
        {!exp || exp.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No other expenses recorded.</Empty></div> : (
          <TableWrap><THead cols={['Date', 'Salesperson', 'Category', 'Note', 'Amount', '']} /><tbody>{exp.items.map((e) => (
            <tr key={e.id}><Td>{fmtDate(e.date)}</Td><Td className="font-medium">{e.owner_name}</Td><Td>{e.category}</Td><Td className="text-[#5B6070]">{e.note}</Td><Td className="font-medium">{inr(e.amount)}</Td>
              <Td className="text-right">{write && <button type="button" aria-label="Delete expense" onClick={() => removeExpense(e)} className="rounded p-1.5 text-[#B91C1C] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}</Td></tr>))}</tbody></TableWrap>)}
      </section>
      {adding && meta && <ExpenseModal meta={meta} people={meta.salespeople} month={month} onClose={() => setAdding(false)} onDone={reloadExp} />}
      {paying && <PayTravelModal person={paying} month={month} onClose={() => setPaying(null)} onDone={reload} />}
    </>
  );
};

// ---------------------------------------------------------------- the monthly report for the owner
const ReportBody = ({ d }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat label="Total running cost" value={inr(d.running_cost)} hint={`Sales ${shortInr(d.sales_cost)} · salaries ${shortInr(d.payroll.approved)} · company ${shortInr(d.company_expenses.total)}`} />
      <Stat label="Km travelled" value={num(d.travel.km)} hint={`at ₹${d.travel.rate} per km`} />
      <Stat label="Money received" value={inr(d.money.received_total)} hint={`ERP ${shortInr(d.money.received_erp)} · others ${shortInr(d.money.received_other)}`} />
      <Stat label="Still to collect" value={inr(d.receivables.outstanding)} tone={d.receivables.overdue ? 'warn' : 'ink'} hint={`${inr(d.receivables.overdue)} overdue`} />
    </div>
    <Card title="What it cost to run Orison this month" subtitle="Sales team, salaries and company expenses together">
      <table className="w-full text-[14px]"><tbody>
        {[['Sales team: travel allowance and expense claims', d.sales_cost], ['Employee salaries (approved)', d.payroll.approved], ['Company expenses', d.company_expenses.total]].map(([k, v]) => <tr key={k} className="border-t border-[#F0ECE2] first:border-0"><td className="py-2">{k}</td><td className="py-2 text-right font-medium">{inr(v)}</td></tr>)}
        <tr className="border-t-2 border-[#E2DDD1]"><td className="py-2 font-semibold">Total running cost</td><td className="py-2 text-right text-[16px] font-semibold">{inr(d.running_cost)}</td></tr>
      </tbody></table>
      <p className="mt-2 text-[13px] text-[#5B6070]">Salaries: {inr(d.payroll.paid)} paid, {inr(d.payroll.balance)} still to pay{d.payroll.drafts > 0 ? `, ${d.payroll.drafts} not yet approved` : ''}.{Object.keys(d.company_expenses.by_category).length > 0 ? ` Company expenses: ${Object.entries(d.company_expenses.by_category).map(([k, v]) => `${k} ${inr(v)}`).join(' · ')}.` : ''}</p>
    </Card>
    <Card title="Sales team: travel and expenses">
      {d.travel.people.length === 0 ? <Empty>No travel this month.</Empty> : (
        <table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] uppercase tracking-wide text-[#6B7080]"><th className="pb-2">Salesperson</th><th className="pb-2">Days</th><th className="pb-2">Km</th><th className="pb-2">Allowance</th><th className="pb-2">Other expenses</th><th className="pb-2">Status</th></tr></thead>
          <tbody>{d.travel.people.map((p) => <tr key={p.name} className="border-t border-[#F0ECE2]"><td className="py-2 font-medium">{p.name}</td><td>{p.days}</td><td>{p.km}</td><td>{inr(p.amount)}</td><td>{inr(d.expenses.by_person[p.name] || 0)}</td><td><Pill tone={statusTone[p.status]}>{p.status}</Pill></td></tr>)}</tbody></table>)}
      {(d.travel.missing > 0 || d.travel.flags > 0) && <p className="mt-3 text-[13px] text-amber-800">{d.travel.missing} distance(s) missing and {d.travel.flags} that look wrong are still open.</p>}
      {Object.keys(d.expenses.by_category).length > 0 && <p className="mt-3 text-[13px] text-[#5B6070]">Other expenses by type: {Object.entries(d.expenses.by_category).map(([k, v]) => `${k} ${inr(v)}`).join(' · ')}</p>}
    </Card>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Billed and received this month">
        <table className="w-full text-[14px]"><tbody>
          {[['Billed: ERP', d.money.invoiced_erp], ['Billed: other products', d.money.invoiced_other], ['Received: ERP', d.money.received_erp], ['Received: other products', d.money.received_other]].map(([k, v]) => <tr key={k} className="border-t border-[#F0ECE2] first:border-0"><td className="py-2">{k}</td><td className="py-2 text-right font-medium">{inr(v)}</td></tr>)}
        </tbody></table>
      </Card>
      <Card title="Promises by school leaders">
        <table className="w-full text-[14px]"><tbody>
          {[['Promises noted this month', d.promises.made], ['Kept this month', d.promises.kept], ['Still waiting', d.promises.pending], ['Date passed, not paid', d.promises.missed], ['Moved to a new date', d.promises.rescheduled]].map(([k, v]) => <tr key={k} className="border-t border-[#F0ECE2] first:border-0"><td className="py-2">{k}</td><td className="py-2 text-right font-medium">{v}</td></tr>)}
        </tbody></table>
      </Card>
    </div>
    <Card title="Biggest overdue payments">
      {d.receivables.top_overdue.length === 0 ? <Empty>Nothing is overdue.</Empty> : (
        <table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] uppercase tracking-wide text-[#6B7080]"><th className="pb-2">School</th><th className="pb-2">Product</th><th className="pb-2">Owes</th><th className="pb-2">Late</th><th className="pb-2">Promised for</th></tr></thead>
          <tbody>{d.receivables.top_overdue.map((r) => <tr key={r.invoice} className="border-t border-[#F0ECE2]"><td className="py-2 font-medium">{r.school}</td><td>{r.product}</td><td>{inr(r.outstanding)}</td><td>{r.days_overdue} days</td><td>{r.promise_on ? fmtDate(r.promise_on) : <b className="text-red-700">no promise</b>}</td></tr>)}</tbody></table>)}
    </Card>
  </div>
);

export const ReportsPage = () => {
  const write = useWrite();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState('');
  const { data: live, loading, error, reload } = useFetch('/finance/report', { month });
  const { data: sent, reload: reloadSent } = useFetch('/finance/reports');
  const { data: saved } = useFetch(open ? `/finance/reports/${open}` : '/finance/meta');
  const send = async () => {
    if (!(await askConfirm(`Send the ${monthLabel(month)} report to the owner? The figures are saved as they are now.`))) return;
    setBusy(true);
    try { await pApi.post('/finance/reports', { month, note }); notify('Report sent to the owner', 'success'); setNote(''); reloadSent(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const ownerView = sent?.owner_view;
  return (
    <>
      <PageHead title="Reports" subtitle={ownerView ? 'Monthly reports from your accounts team, and a live view of any month.' : 'Check the month, add a note, and send it to the owner.'}
        actions={<><input type="month" value={month} max={today().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" className={`${selectCls} w-44`} /><Btn variant="ghost" onClick={() => window.print()}><FileText className="h-4 w-4" />Print this page</Btn></>} />
      {sent && sent.items.length > 0 && (
        <section className="mb-8" aria-label="Reports already sent">
          <SectionTitle>{ownerView ? 'Sent to you' : 'Sent to the owner'}{sent.unseen > 0 && ownerView ? <span className="ml-2 rounded-full bg-[#2E2A6E] px-2 py-0.5 align-middle text-[12px] text-white">{sent.unseen} new</span> : null}</SectionTitle>
          <ul className="space-y-2.5">{sent.items.map((r) => (
            <li key={r.id}><button type="button" onClick={() => setOpen(open === r.id ? '' : r.id)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2DDD1] bg-white px-4 py-3 text-left hover:bg-[#FAF8F3]">
              <span><b className="text-[#1F2433]">{monthLabel(r.month)}</b>{ownerView && !r.seen && <span className="ml-2 rounded-full bg-[#2E2A6E] px-2 py-0.5 text-[11px] text-white">New</span>}<span className="block text-[12.5px] text-[#6B7080]">{r.submitted_by} · {fmtDateTime(r.at)}{r.note ? ` · ${r.note}` : ''}</span></span>
              <span className="text-[13px] text-[#4A4F5C]">Sales cost <b>{shortInr(r.headline.sales_cost)}</b> · received <b>{shortInr(r.headline.received)}</b> · to collect <b>{shortInr(r.headline.outstanding)}</b></span></button>
              {open === r.id && open && saved?.data && <div className="mt-3 rounded-2xl border border-[#E2DDD1] bg-[#FAF8F3] p-4"><ReportBody d={saved.data} /></div>}
            </li>))}</ul>
        </section>
      )}
      <SectionTitle right={<Btn variant="ghost" onClick={reload}>Refresh</Btn>}>{monthLabel(month)} (live)</SectionTitle>
      {loading && !live ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (<>
        <ReportBody d={live} />
        {write && (
          <section className="mt-6 rounded-2xl border border-[#E2DDD1] bg-white p-5">
            <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#1F2433]"><FileText className="h-4 w-4" />Send this report to the owner</p>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short note: anything the owner should look at first, schools to push, expenses to question…" className={`${inputCls} h-auto py-2`} />
            <div className="mt-3"><Btn onClick={send} busy={busy}><Send className="h-4 w-4" />Send to owner</Btn></div>
          </section>)}
      </>)}
    </>
  );
};


// ---------------------------------------------------------------- expense claims with a bill photo
const claimTone = { Submitted: 'amber', Approved: 'indigo', Paid: 'green', Rejected: 'red' };

const BillThumbs = ({ claim }) => {
  const [open, setOpen] = useState(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">{claim.photos.map((p) => (
        <button key={p.id} type="button" onClick={() => setOpen(p)} aria-label="Open the bill" className="h-14 w-14 overflow-hidden rounded-lg border border-[#E2DDD1] bg-[#F4F1EA]"><AuthImage path={`/finance/claims/${claim.id}/photos/${p.id}?size=thumb`} alt="Bill" className="h-full w-full object-cover" /></button>))}</div>
      {open && <Modal title={`Bill: ${claim.category}, ${inr(claim.claimed_amount || claim.amount)}`} onClose={() => setOpen(null)} wide><AuthImage path={`/finance/claims/${claim.id}/photos/${open.id}`} alt="Bill" className="max-h-[70vh] w-full rounded-xl bg-[#F4F1EA] object-contain" /></Modal>}
    </>
  );
};

export const MyExpensesPage = () => {
  const { data, loading, error, reload } = useFetch('/finance/my-claims');
  const [f, setF] = useState({ date: today(), category: 'Food', amount: '', note: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const camera = React.useRef(null); const gallery = React.useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = (list) => { const picked = Array.from(list || []); setFiles((x) => [...x, ...picked].slice(0, 4)); if (camera.current) camera.current.value = ''; if (gallery.current) gallery.current.value = ''; };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.amount || Number(f.amount) <= 0) return notify('Enter the amount you spent.', 'error');
    if (f.note.trim().length < 3) return notify('Write what the expense was for.', 'error');
    if (files.length === 0) return notify('Add a photo of the bill.', 'error');
    setBusy(true);
    try {
      const form = new FormData(); Object.entries(f).forEach(([k, v]) => form.append(k, v)); files.forEach((x) => form.append('files', x));
      await pApi.post('/finance/my-claims', form); notify('Sent to Accounts', 'success'); setF({ ...f, amount: '', note: '' }); setFiles([]); reload();
    } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const withdraw = async (c) => { if (!(await askConfirm('Withdraw this claim?'))) return; try { await pApi.delete(`/finance/my-claims/${c.id}`); notify('Withdrawn', 'success'); reload(); } catch (err) { notify(errText(err), 'error'); } };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <>
      <PageHead title="My expenses" subtitle="Spent something for the job (toll, stay, fuel)? Add it here with a photo of the bill. Only Accounts approves it. Your travel km (₹3 each) and food (₹150 for every day you visit schools) are added automatically from your visits, so do not claim them here." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Waiting for Accounts" value={inr(data.totals.Submitted)} tone={data.totals.Submitted ? 'warn' : 'ink'} />
        <Stat label="Approved" value={inr(data.totals.Approved)} />
        <Stat label="Paid" value={inr(data.totals.Paid)} />
        <Stat label="Rejected" value={inr(data.totals.Rejected)} tone={data.totals.Rejected ? 'bad' : 'ink'} />
      </div>
      <Card title="Add an expense" className="mt-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><input type="date" max={today()} value={f.date} onChange={set('date')} className={inputCls} /></Field>
          <Field label="Category"><select value={f.category} onChange={set('category')} className={inputCls}>{data.categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Amount (₹)"><input type="number" min="1" step="0.01" value={f.amount} onChange={set('amount')} className={inputCls} /></Field>
          <Field label="What was it for"><input value={f.note} onChange={set('note')} placeholder="e.g. Lunch on the Warangal trip" className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-[#2B3040]">Photo of the bill <span className="text-red-600">*</span></p>
            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="ghost" onClick={() => camera.current?.click()}><Camera className="h-4 w-4" />Take a photo</Btn>
              <Btn variant="ghost" onClick={() => gallery.current?.click()}><ImagePlus className="h-4 w-4" />Choose photo</Btn>
              <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => add(e.target.files)} data-testid="claim-camera" />
              <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => add(e.target.files)} data-testid="claim-gallery" />
              {files.map((x, i) => <span key={`${x.name}${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF8F3] px-3 py-1 text-[12.5px] ring-1 ring-[#DAD6CC]">{x.name.slice(0, 22)}<button type="button" aria-label={`Remove ${x.name}`} onClick={() => setFiles((l) => l.filter((_, k) => k !== i))} className="text-[#B91C1C]">×</button></span>)}
            </div>
          </div>
          <div className="sm:col-span-2"><Btn type="submit" busy={busy}><Send className="h-4 w-4" />Send to Accounts</Btn></div>
        </form>
      </Card>
      <section className="mt-8">
        <SectionTitle>My claims</SectionTitle>
        {data.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No expenses yet.</Empty></div> : (
          <ul className="space-y-2.5">{data.items.map((c) => (
            <li key={c.id} className="rounded-xl border border-[#E2DDD1] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[#1F2433]">{c.category} · {inr(c.claimed_amount || c.amount)}{c.claimed_amount && c.amount !== c.claimed_amount ? <span className="font-normal text-[#B45309]"> (approved {inr(c.amount)})</span> : ''}</p><p className="text-[13px] text-[#5B6070]">{fmtDate(c.date)} · {c.note}</p></div>
                <div className="flex items-center gap-2"><Pill tone={claimTone[c.status] || 'gray'}>{c.status || 'Approved'}</Pill>{c.status === 'Submitted' && <button type="button" onClick={() => withdraw(c)} className="text-[13px] text-[#B91C1C] hover:underline">Withdraw</button>}</div></div>
              {c.decision_note && <p className={`mt-2 text-[13px] ${c.status === 'Rejected' ? 'text-red-700' : 'text-[#5B6070]'}`}>Accounts: {c.decision_note}</p>}
              {c.photos.length > 0 && <div className="mt-3"><BillThumbs claim={c} /></div>}
            </li>))}</ul>)}
      </section>
    </>
  );
};

const DecideModal = ({ claim, onClose, onDone }) => {
  const [amount, setAmount] = useState(String(claim.claimed_amount || claim.amount));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (decision) => {
    setBusy(true);
    try { await pApi.post(`/finance/claims/${claim.id}/decision`, { decision, note, amount: decision === 'Approved' ? Number(amount) : undefined }); notify(decision === 'Approved' ? 'Approved' : 'Rejected', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${claim.owner_name}: ${claim.category}`} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-[14px] text-[#4A4F5C]">{fmtDate(claim.date)} · claimed <b>{inr(claim.claimed_amount)}</b> · {claim.note}</p>
        <BillThumbs claim={claim} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount to approve (₹)" hint="Lower it if part of the bill is not allowed."><input type="number" min="1" step="0.01" max={claim.claimed_amount} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
          <Field label="Note to the salesperson (needed to reject)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Btn variant="danger" busy={busy} onClick={() => go('Rejected')}>Reject</Btn><Btn busy={busy} onClick={() => go('Approved')}>Approve</Btn></div>
      </div>
    </Modal>
  );
};

const ClaimsReview = ({ month, onChanged }) => {
  const write = useWrite();
  const [status, setStatus] = useState('Submitted');
  const [deciding, setDeciding] = useState(null);
  const { data, reload } = useFetch('/finance/claims', { status });
  const done = () => { reload(); onChanged(); };
  const pay = async (c) => { try { await pApi.post(`/finance/claims/${c.id}/paid`, {}); notify('Marked as paid', 'success'); done(); } catch (err) { notify(errText(err), 'error'); } };
  return (
    <section className="mt-9" aria-label="Expense claims">
      <SectionTitle right={<select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Claim status" className={`${selectCls} w-40`}>{['Submitted', 'Approved', 'Paid', 'Rejected'].map((x) => <option key={x}>{x}</option>)}</select>}>Expense claims from the sales team{data && data.pending > 0 ? <span className="ml-2 rounded-full bg-[#2E2A6E] px-2 py-0.5 align-middle text-[12px] text-white">{data.pending} waiting</span> : null}</SectionTitle>
      {!data || data.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No {status.toLowerCase()} claims.</Empty></div> : (
        <ul className="space-y-2.5">{data.items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2DDD1] bg-white p-4">
            <div className="flex items-center gap-3"><BillThumbs claim={c} /><div><p className="font-semibold text-[#1F2433]">{c.owner_name} · {c.category} · {inr(c.claimed_amount)}</p><p className="text-[13px] text-[#5B6070]">{fmtDate(c.date)} · {c.note}</p></div></div>
            <div className="flex items-center gap-2"><Pill tone={claimTone[c.status]}>{c.status}</Pill>{write && c.status === 'Submitted' && <Btn onClick={() => setDeciding(c)}>Review</Btn>}{write && c.status === 'Approved' && <Btn variant="ghost" onClick={() => pay(c)}>Mark paid</Btn>}</div>
          </li>))}</ul>)}
      {deciding && <DecideModal claim={deciding} onClose={() => setDeciding(null)} onDone={done} />}
      <span className="sr-only">{month}</span>
    </section>
  );
};

// ---------------------------------------------------------------- salaries, staff and company expenses
const salaryTone = { Draft: 'gray', Approved: 'indigo', 'Part paid': 'amber', Paid: 'green' };
const MODES = ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Other'];

const EmployeeModal = ({ employee, onClose, onDone }) => {
  const [f, setF] = useState({ name: employee?.name || '', designation: employee?.designation || '', monthly_salary: String(employee?.monthly_salary ?? ''), joined_on: employee?.joined_on || today(), phone: employee?.phone || '', pay_note: employee?.pay_note || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...f, monthly_salary: Number(f.monthly_salary) };
      if (employee) await pApi.put(`/finance/employees/${employee.id}`, body); else await pApi.post('/finance/employees', body);
      notify('Saved', 'success'); onDone(); onClose();
    } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={employee ? `Edit ${employee.name}` : 'Add an employee'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input autoFocus value={f.name} onChange={set('name')} className={inputCls} /></Field>
        <Field label="Role"><input value={f.designation} onChange={set('designation')} placeholder="Developer, Office assistant…" className={inputCls} /></Field>
        <Field label="Monthly salary (₹)"><input type="number" min="0" step="0.01" value={f.monthly_salary} onChange={set('monthly_salary')} className={inputCls} /></Field>
        <Field label="Joined on"><input type="date" value={f.joined_on} onChange={set('joined_on')} className={inputCls} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={set('phone')} className={inputCls} /></Field>
        <Field label="How they are usually paid" hint="e.g. Bank transfer, HDFC ending 1234. Never type a full account number."><input value={f.pay_note} onChange={set('pay_note')} className={inputCls} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Save</Btn></div>
      </form>
    </Modal>
  );
};

const SalaryEditModal = ({ row, onClose, onDone }) => {
  const [f, setF] = useState({ additions: String(row.additions || ''), deductions: String(row.deductions || ''), note: row.note || '' });
  const [busy, setBusy] = useState(false);
  const net = Number(row.base) + Number(f.additions || 0) - Number(f.deductions || 0);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.put(`/finance/payroll/${row.id}`, { additions: Number(f.additions || 0), deductions: Number(f.deductions || 0), note: f.note }); notify('Saved', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${row.employee_name}: this month's salary`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-[#FAF8F3] px-3 py-2 text-[14px]">Monthly salary <b>{inr(row.base)}</b></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Add (incentive, bonus) ₹"><input type="number" min="0" step="0.01" value={f.additions} onChange={(e) => setF({ ...f, additions: e.target.value })} className={inputCls} /></Field>
          <Field label="Deduct (leave, advance) ₹"><input type="number" min="0" step="0.01" value={f.deductions} onChange={(e) => setF({ ...f, deductions: e.target.value })} className={inputCls} /></Field>
        </div>
        <Field label="Reason (needed when you add or deduct)"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Leave 2 days, festival bonus" className={inputCls} /></Field>
        <div className="rounded-xl bg-[#2E2A6E] px-4 py-3 text-white"><p className="text-[12px] text-white/70">Net salary to pay</p><p style={serif} className="text-[24px]">{inr(net)}</p></div>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Save</Btn></div>
      </form>
    </Modal>
  );
};

const SalaryPayModal = ({ row, onClose, onDone }) => {
  const [f, setF] = useState({ amount: String(row.balance), date: today(), mode: 'Bank transfer', reference: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post(`/finance/payroll/${row.id}/payments`, { ...f, amount: Number(f.amount) }); notify('Payment recorded', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Pay ${row.employee_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-[#FAF8F3] px-3 py-2 text-[14px]">Net salary {inr(row.net)} · already paid {inr(row.paid_amount)} · <b>left to pay {inr(row.balance)}</b></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount paid now (₹)" hint="Less than the balance is a part payment."><input type="number" min="1" step="0.01" max={row.balance} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
          <Field label="Paid on"><input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
          <Field label="Paid how"><select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} className={inputCls}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Reference (UTR, cheque no.)"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Save payment</Btn></div>
      </form>
    </Modal>
  );
};

const CompanyExpenseModal = ({ meta, onClose, onDone }) => {
  const [f, setF] = useState({ date: today(), category: 'Rent', vendor: '', amount: '', mode: 'Bank transfer', reference: '', note: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post('/finance/company-expenses', { ...f, amount: Number(f.amount) }); notify('Expense added', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add a company expense" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Date"><input type="date" max={today()} value={f.date} onChange={set('date')} className={inputCls} /></Field>
        <Field label="Category"><select value={f.category} onChange={set('category')} className={inputCls}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Paid to"><input value={f.vendor} onChange={set('vendor')} placeholder="Landlord, hosting company…" className={inputCls} /></Field>
        <Field label="Amount (₹)"><input type="number" min="1" step="0.01" value={f.amount} onChange={set('amount')} className={inputCls} /></Field>
        <Field label="Paid how"><select value={f.mode} onChange={set('mode')} className={inputCls}>{meta.modes.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference (UTR, bill no.)"><input value={f.reference} onChange={set('reference')} className={inputCls} /></Field>
        <div className="sm:col-span-2"><Field label="Note"><input value={f.note} onChange={set('note')} className={inputCls} /></Field></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Add expense</Btn></div>
      </form>
    </Modal>
  );
};

export const PayrollPage = () => {
  const { permissions } = usePlatform();
  const write = useWrite();
  const isOwner = permissions.includes('*');
  const [tab, setTab] = useState('salaries');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [modal, setModal] = useState({});
  const [busy, setBusy] = useState(false);
  const pay = useFetch('/finance/payroll', { month });
  const staff = useFetch('/finance/employees');
  const exp = useFetch('/finance/company-expenses', { month });
  const act = async (fn, ok) => { try { await fn(); if (ok) notify(ok, 'success'); pay.reload(); } catch (err) { notify(errText(err), 'error'); } };
  const prepare = async () => { setBusy(true); await act(async () => { const { data } = await pApi.post('/finance/payroll/generate', { month }); notify(data.added ? `${data.added} salary line${data.added === 1 ? '' : 's'} prepared` : 'Nothing new to prepare', 'success'); }); setBusy(false); };
  const removeLine = async (r) => { if (await askConfirm(`Remove ${r.employee_name}'s line for this month?`)) act(() => pApi.delete(`/finance/payroll/${r.id}`), 'Removed'); };
  const removeExpense = async (x) => { if (await askConfirm('Delete this expense?')) { try { await pApi.delete(`/finance/company-expenses/${x.id}`); notify('Deleted', 'success'); exp.reload(); } catch (err) { notify(errText(err), 'error'); } } };
  const d = pay.data;
  return (
    <>
      <PageHead title="Salaries and company expenses" subtitle="Prepare the month's salaries, approve each one yourself, and record how much was paid and how. Company costs are kept here too."
        actions={<><input type="month" value={month} max={today().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" className={`${selectCls} w-44`} /><Btn variant="ghost" onClick={() => downloadFile('/finance/payroll.csv', { month }, `salary-register-${month}.csv`)}><Download className="h-4 w-4" />Salary register</Btn></>} />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {[['salaries', 'Salaries'], ['staff', 'Staff list'], ['company', 'Company expenses']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-1.5 text-[13.5px] font-medium ${tab === k ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}>{l}</button>)}
      </div>

      {tab === 'salaries' && (pay.loading && !d ? <Loading /> : pay.error ? <ErrorBox message={pay.error} onRetry={pay.reload} /> : (<>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Approved to pay" value={inr(d.totals.approved)} hint={monthLabel(month)} />
          <Stat label="Paid so far" value={inr(d.totals.paid)} />
          <Stat label="Still to pay" value={inr(d.totals.balance)} tone={d.totals.balance ? 'warn' : 'ink'} />
          <Stat label="Waiting for your approval" value={String(d.totals.draft)} tone={d.totals.draft ? 'warn' : 'ink'} hint={`${d.totals.people} salary lines`} />
        </div>
        {write && (d.not_prepared.length > 0 || d.items.length === 0) && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2DDD1] bg-white p-5">
            <p className="text-[14px] text-[#4A4F5C]">{d.items.length === 0 ? `Salaries for ${monthLabel(month)} are not prepared yet.` : `${d.not_prepared.length} employee${d.not_prepared.length === 1 ? ' is' : 's are'} not in this month's list: ${d.not_prepared.map((n) => n.name).join(', ')}.`}</p>
            <Btn onClick={prepare} busy={busy}>Prepare {monthLabel(month)} salaries</Btn>
          </div>)}
        <div className="mt-5">
          {d.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No salary lines yet. The owner adds employees and their salaries in the Staff list; then Accounts prepares the month.</Empty></div> : (
            <TableWrap>
              <THead cols={['Employee', 'Salary', 'Add / deduct', 'Net', 'Paid', 'Status', '']} />
              <tbody>{d.items.map((r) => (
                <tr key={r.id} className="align-top">
                  <Td className="font-medium">{r.employee_name}<div className="text-[12px] font-normal text-[#6B7080]">{r.designation}</div></Td>
                  <Td>{inr(r.base)}</Td>
                  <Td>{r.additions || r.deductions ? <>{r.additions ? <span className="text-emerald-700">+{inr(r.additions)}</span> : null}{r.additions && r.deductions ? ' ' : ''}{r.deductions ? <span className="text-red-700">−{inr(r.deductions)}</span> : null}<div className="text-[12px] text-[#6B7080]">{r.note}</div></> : <span className="text-[#A5A08F]">—</span>}</Td>
                  <Td className="font-semibold">{inr(r.net)}</Td>
                  <Td>{r.paid_amount ? inr(r.paid_amount) : '—'}{r.payments.map((p) => <div key={p.id} className="text-[12px] text-[#6B7080]">{fmtDate(p.date)} · {p.mode}{p.reference ? ` · ${p.reference}` : ''} · {inr(p.amount)}</div>)}</Td>
                  <Td><Pill tone={salaryTone[r.status]}>{r.status}</Pill>{r.status === 'Approved' || r.status === 'Part paid' ? <div className="mt-1 text-[12px] text-[#6B7080]">Approved by {r.approved_by}</div> : null}</Td>
                  <Td className="whitespace-nowrap text-right">{(<>
                    {write && r.status === 'Draft' && <><button onClick={() => setModal({ edit: r })} className="mr-3 text-[13px] font-medium text-[#3F3A8C] hover:underline">Edit</button><button onClick={() => act(() => pApi.post(`/finance/payroll/${r.id}/approve`), `${r.employee_name}: approved`)} className="mr-3 text-[13px] font-medium text-emerald-700 hover:underline">Approve</button><button onClick={() => removeLine(r)} className="text-[13px] text-[#B91C1C] hover:underline">Remove</button></>}
                    <button onClick={() => printPayslip(r.id)} className="mr-3 text-[13px] font-medium text-[#6B7080] hover:underline">Payslip</button>{write && (r.status === 'Approved' || r.status === 'Part paid') && <button onClick={() => setModal({ pay: r })} className="mr-3 text-[13px] font-medium text-emerald-700 hover:underline">Record payment</button>}
                    {write && r.status === 'Approved' && <button onClick={() => act(() => pApi.post(`/finance/payroll/${r.id}/reopen`), 'Reopened')} className="text-[13px] text-[#6B7080] hover:underline">Reopen</button>}</>)}</Td>
                </tr>))}</tbody>
            </TableWrap>)}
        </div>
      </>))}

      {tab === 'staff' && (staff.loading && !staff.data ? <Loading /> : staff.error ? <ErrorBox message={staff.error} onRetry={staff.reload} /> : (<>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[14px] text-[#4A4F5C]">Monthly salaries of active staff: <b>{inr(staff.data.monthly_total)}</b></p>{isOwner && <Btn onClick={() => setModal({ employee: {} })}><Plus className="h-4 w-4" />Add employee</Btn>}</div>
        {staff.data.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No employees yet.</Empty></div> : (
          <TableWrap><THead cols={['Name', 'Role', 'Monthly salary', 'Joined', 'Usually paid', '']} /><tbody>{staff.data.items.map((e) => (
            <tr key={e.id} className={e.active ? '' : 'opacity-50'}><Td className="font-medium">{e.name}{!e.active && <span className="ml-2 text-[12px] font-normal text-[#6B7080]">left</span>}<div className="text-[12px] font-normal text-[#6B7080]">{e.phone}</div></Td><Td>{e.designation}</Td><Td className="font-medium">{inr(e.monthly_salary)}</Td><Td>{fmtDate(e.joined_on)}</Td><Td className="text-[13px] text-[#5B6070]">{e.pay_note}</Td>
              <Td className="whitespace-nowrap text-right">{isOwner && <><button onClick={() => setModal({ employee: e })} className="mr-3 text-[13px] font-medium text-[#3F3A8C] hover:underline">Edit</button><button onClick={async () => { try { await pApi.put(`/finance/employees/${e.id}`, { active: !e.active }); staff.reload(); } catch (err) { notify(errText(err), 'error'); } }} className="text-[13px] text-[#6B7080] hover:underline">{e.active ? 'Mark as left' : 'Rejoined'}</button></>}</Td></tr>))}</tbody></TableWrap>)}
      </>))}

      {tab === 'company' && (exp.loading && !exp.data ? <Loading /> : exp.error ? <ErrorBox message={exp.error} onRetry={exp.reload} /> : (<>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[14px] text-[#4A4F5C]">{monthLabel(month)} total <b>{inr(exp.data.total)}</b>{Object.entries(exp.data.by_category).map(([k, v]) => <span key={k}> · {k} {inr(v)}</span>)}</p>{write && <Btn onClick={() => setModal({ company: true })}><Plus className="h-4 w-4" />Add expense</Btn>}</div>
        {exp.data.items.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No company expenses recorded for {monthLabel(month)}.</Empty></div> : (
          <TableWrap><THead cols={['Date', 'Category', 'Paid to', 'How', 'Note', 'Amount', '']} /><tbody>{exp.data.items.map((x) => (
            <tr key={x.id}><Td>{fmtDate(x.date)}</Td><Td className="font-medium">{x.category}</Td><Td>{x.vendor}</Td><Td>{x.mode}{x.reference && <div className="text-[12px] text-[#6B7080]">{x.reference}</div>}</Td><Td className="text-[#5B6070]">{x.note}</Td><Td className="font-medium">{inr(x.amount)}</Td>
              <Td className="text-right">{write && <button type="button" aria-label="Delete expense" onClick={() => removeExpense(x)} className="rounded p-1.5 text-[#B91C1C] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}</Td></tr>))}</tbody></TableWrap>)}
      </>))}

      {modal.edit && <SalaryEditModal row={modal.edit} onClose={() => setModal({})} onDone={pay.reload} />}
      {modal.pay && <SalaryPayModal row={modal.pay} onClose={() => setModal({})} onDone={pay.reload} />}
      {modal.employee && <EmployeeModal employee={modal.employee.id ? modal.employee : null} onClose={() => setModal({})} onDone={() => { staff.reload(); pay.reload(); }} />}
      {modal.company && exp.data && <CompanyExpenseModal meta={exp.data} onClose={() => setModal({})} onDone={exp.reload} />}
    </>
  );
};
