import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { askConfirm, notify } from '../components/AppFeedback';
import {
  Btn, Card, Empty, ErrorBox, Field, Loading, Meter, Modal, PageHead, Pill, TableWrap, Td, THead, fmtDate, inputCls, inr, num, planTone,
  statusTone, selectCls } from './ui';

const PLAN_LABEL = { essential: 'Essential', pro: 'Pro', premium: 'Premium' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Opens a clean, printable invoice. The window is opened first so the browser does not block it.
const printInvoice = async (inv) => {
  const win = window.open('', '_blank');
  if (!win) return notify('Allow pop-ups for this site to print the invoice.', 'error');
  try {
    const { data } = await pApi.get('/plans');
    const s = data.settings;
    const row = (label, value, bold) => `<tr><td>${esc(label)}</td><td class="r${bold ? ' b' : ''}">${esc(value)}</td></tr>`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number)}</title><style>
      body{font:14px/1.5 Arial,sans-serif;color:#1F2433;margin:40px}h1{font-size:22px;margin:0}.muted{color:#5B6070}
      table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:8px 0;border-bottom:1px solid #E2DDD1}.r{text-align:right}.b{font-weight:700}
      .head{display:flex;justify-content:space-between;margin-bottom:24px}</style></head><body>
      <div class="head"><div><h1>${esc(s.company_name)}</h1><div class="muted">${esc(s.address)}</div>${s.gstin ? `<div class="muted">GSTIN: ${esc(s.gstin)}</div>` : ''}</div>
      <div class="r"><h1>TAX INVOICE</h1><div>${esc(inv.number)}</div><div class="muted">Issued ${esc(inv.issued_on)} · Due ${esc(inv.due_on)}</div></div></div>
      <div><b>Billed to:</b> ${esc(inv.school_name)}</div>
      <div class="muted">${esc(PLAN_LABEL[inv.plan])} plan${inv.academic_year ? ` · Academic year ${esc(inv.academic_year)}` : ''}</div>
      <table>
        ${row(`Subscription: ${inv.students} students × ${inr(inv.rate_per_student)}`, inr(inv.students * inv.rate_per_student))}
        ${inv.discount_amount ? row(`Discount (${inv.discount_percent}%)`, `− ${inr(inv.discount_amount)}`) : ''}
        ${inv.minimum_applied ? row(`Minimum yearly fee applied`, inr(inv.subscription)) : ''}
        ${inv.setup_fee ? row('One-time setup fee', inr(inv.setup_fee)) : ''}
        ${row('Taxable value', inr(inv.taxable))}${row(`GST ${inv.gst_percent}%`, inr(inv.gst))}${row('Total', inr(inv.total), true)}
      </table>
      ${inv.note ? `<p class="muted">${esc(inv.note)}</p>` : ''}
      <p class="muted">Status: ${esc(inv.status)}${inv.paid_on ? ` on ${esc(inv.paid_on)}` : ''}</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  } catch (err) {
    win.close();
    notify(errText(err), 'error');
  }
};

const PayModal = ({ invoice, onClose, onDone }) => {
  const [f, setF] = useState({ method: 'Bank transfer', reference: '', paid_on: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await pApi.put(`/invoices/${invoice.id}/status`, { status: 'Paid', ...f }); notify('Marked as paid', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Mark ${invoice.number} as paid`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[14px] text-[#5B6070]">{invoice.school_name} · {inr(invoice.total)}</p>
        <Field label="Payment method"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={inputCls}>{['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Online payment'].map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference (UTR / cheque number)"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={inputCls} /></Field>
        <Field label="Paid on"><input type="date" value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} className={inputCls} /></Field>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Mark as paid</Btn></div>
      </form>
    </Modal>
  );
};

export const InvoiceTable = ({ invoices, onChanged, embedded = false }) => {
  const { can } = usePlatform();
  const [paying, setPaying] = useState(null);
  const cancel = async (inv) => {
    if (!(await askConfirm(`Cancel invoice ${inv.number}?`))) return;
    try { await pApi.put(`/invoices/${inv.id}/status`, { status: 'Cancelled' }); notify('Invoice cancelled', 'success'); onChanged(); } catch (err) { notify(errText(err), 'error'); }
  };
  const cols = ['Invoice', ...(embedded ? [] : ['School']), 'Issued', 'Due', 'Total', 'Status', ''];
  return (
    <>
      <TableWrap>
        <THead cols={cols} />
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <Td className="font-medium">{inv.number}{inv.academic_year && <div className="text-[12px] font-normal text-[#6B7080]">{inv.academic_year}</div>}</Td>
              {!embedded && <Td><Link to={`/platform/schools/${inv.school_id}`} className="text-[#2E2A6E] hover:underline">{inv.school_name}</Link></Td>}
              <Td>{fmtDate(inv.issued_on)}</Td><Td>{fmtDate(inv.due_on)}</Td><Td className="font-medium">{inr(inv.total)}</Td>
              <Td><Pill tone={statusTone[inv.status]}>{inv.status}</Pill>{inv.paid_on && <div className="text-[12px] text-[#6B7080]">{fmtDate(inv.paid_on)} · {inv.payment_reference || inv.payment_method}</div>}</Td>
              <Td className="whitespace-nowrap text-right">
                <button onClick={() => printInvoice(inv)} className="mr-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#3F3A8C] hover:underline"><Printer className="h-3.5 w-3.5" />Print</button>
                {can('billing:write') && inv.status === 'Unpaid' && (<>
                  <button onClick={() => setPaying(inv)} className="mr-3 text-[13px] font-medium text-emerald-700 hover:underline">Mark paid</button>
                  <button onClick={() => cancel(inv)} className="text-[13px] font-medium text-red-700 hover:underline">Cancel</button></>)}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} onDone={onChanged} />}
    </>
  );
};

export const BillingPanel = ({ school, onChanged }) => {
  const { can } = usePlatform();
  const [students, setStudents] = useState(String(school.student_count || 0));
  const [year, setYear] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await pApi.get(`/schools/${school.id}/billing-preview`, { params: { students: Number(students || 0) } });
        if (alive) { setPreview(data); setError(''); }
      } catch (err) { if (alive) setError(errText(err)); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [school.id, students, school.plan, school.discount_percent, school.setup_fee_waived]);
  const create = async () => {
    if (!(await askConfirm(`Create an invoice of ${inr(preview.total)} for ${school.name}?`))) return;
    setBusy(true);
    try { await pApi.post(`/schools/${school.id}/invoices`, { student_count: Number(students || 0), academic_year: year, note }); notify('Invoice created', 'success'); onChanged(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const L = ({ k, v, strong }) => <div className={`flex justify-between py-2 text-[14px] ${strong ? 'border-t border-[#E2DDD1] font-semibold' : ''}`}><span className="text-[#5B6070]">{k}</span><span>{v}</span></div>;
  return (
    <Card title="Invoice for the academic year" subtitle="Billed on students enrolled at the start of the academic year. Rates come from Plans & pricing.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Students enrolled at start of year"><input type="number" min="0" value={students} onChange={(e) => setStudents(e.target.value)} className={inputCls} /></Field>
          <Field label="Academic year"><input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026-27" className={inputCls} /></Field>
          <Field label="Note on invoice"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
          {can('billing:write') && <Btn onClick={create} busy={busy} disabled={!preview}>Create invoice</Btn>}
        </div>
        <div className="rounded-xl bg-[#FAF8F3] p-4">
          {error ? <ErrorBox message={error} /> : !preview ? <Loading /> : (<>
            <L k={`${num(preview.students)} students × ${inr(preview.rate_per_student)}`} v={inr(preview.students * preview.rate_per_student)} />
            {preview.discount_amount > 0 && <L k={`Discount ${preview.discount_percent}%`} v={`− ${inr(preview.discount_amount)}`} />}
            {preview.minimum_applied && <L k="Minimum yearly fee applied" v={inr(preview.minimum_fee)} />}
            {preview.setup_fee > 0 && <L k="One-time setup fee" v={inr(preview.setup_fee)} />}
            <L k="Taxable value" v={inr(preview.taxable)} /><L k={`GST ${preview.gst_percent}%`} v={inr(preview.gst)} /><L k="Total" v={inr(preview.total)} strong />
          </>)}
        </div>
      </div>
    </Card>
  );
};

export const InvoicesPage = () => {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useFetch('/invoices', { status });
  return (
    <>
      <PageHead title="Invoices" subtitle="Subscription invoices raised to schools." />
      <div className="mb-4"><select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectCls} w-44`} aria-label="Status"><option value="">All statuses</option>{['Unpaid', 'Paid', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}</select></div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? <Card><Empty>No invoices yet. Create one from a school's Billing tab.</Empty></Card> : <InvoiceTable invoices={data} onChanged={reload} />}
    </>
  );
};

const PlanCard = ({ plan, editable, onSaved }) => {
  const [f, setF] = useState({ rate_per_student: plan.rate_per_student, minimum_fee: plan.minimum_fee, setup_fee: plan.setup_fee, whatsapp_per_student: plan.whatsapp_per_student });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await pApi.put(`/plans/${plan.id}`, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v || 0)])));
      notify(`${plan.label} pricing saved`, 'success'); onSaved();
    } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const N = ({ k, label }) => <Field label={label}><input type="number" min="0" disabled={!editable} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inputCls} /></Field>;
  return (
    <Card title={plan.label} action={<Pill tone={planTone[plan.id]}>{plan.features.length} features</Pill>}>
      <div className="space-y-3">
        <N k="rate_per_student" label="Rate per student per year (₹)" /><N k="minimum_fee" label="Minimum yearly fee (₹)" />
        <N k="setup_fee" label="One-time setup fee (₹)" /><N k="whatsapp_per_student" label="WhatsApp messages per student per month" />
      </div>
      <p className="mt-4 text-[12.5px] text-[#6B7080]">Logins: {plan.logins.map((l) => l.replace('_', ' ')).join(', ')}</p>
      {editable && <div className="mt-4"><Btn onClick={save} busy={busy}>Save {plan.label}</Btn></div>}
    </Card>
  );
};

export const PlansPage = () => {
  const { can } = usePlatform();
  const editable = can('plans:write');
  const { data, loading, error, reload } = useFetch('/plans');
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(data.settings); }, [data]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !s) return <Loading />;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      await pApi.put('/settings', {
        gst_percent: Number(s.gst_percent), overage_rate_per_message: Number(s.overage_rate_per_message), payment_terms_days: Number(s.payment_terms_days),
        invoice_prefix: s.invoice_prefix, company_name: s.company_name, gstin: s.gstin, address: s.address,
      });
      notify('Billing settings saved', 'success'); reload();
    } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const T = ({ k, label, type = 'text', span }) => <div className={span ? 'sm:col-span-2' : ''}><Field label={label}><input type={type} disabled={!editable} value={s[k]} onChange={set(k)} className={inputCls} /></Field></div>;
  return (
    <>
      <PageHead title="Plans & pricing" subtitle={editable ? 'Every amount is a setting. Changes apply to new invoices only.' : 'Read only. Only an Owner can change prices.'} />
      <div className="grid gap-5 lg:grid-cols-3">{data.plans.map((p) => <PlanCard key={`${p.id}-${p.rate_per_student}-${p.minimum_fee}-${p.setup_fee}-${p.whatsapp_per_student}`} plan={p} editable={editable} onSaved={reload} />)}</div>
      <div className="mt-6"><Card title="Billing settings" subtitle="Used on every invoice.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <T k="gst_percent" label="GST %" type="number" /><T k="overage_rate_per_message" label="Extra WhatsApp message rate (₹)" type="number" /><T k="payment_terms_days" label="Payment due after (days)" type="number" />
          <T k="invoice_prefix" label="Invoice number prefix" /><T k="company_name" label="Company name on invoice" /><T k="gstin" label="GSTIN" />
          <T k="address" label="Company address" span />
        </div>
        {editable && <div className="mt-5"><Btn onClick={save} busy={busy}>Save billing settings</Btn></div>}
      </Card></div>
    </>
  );
};

export const UsagePage = () => {
  const { data, loading, error, reload } = useFetch('/usage');
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const tone = { ok: 'green', warn: 'amber', over: 'red' };
  const label = { ok: 'Within limit', warn: 'Near limit', over: 'Limit reached' };
  return (
    <>
      <PageHead title="Usage & alerts" subtitle={`WhatsApp messages this month against each school's plan limit. Extra messages are billed at ${inr(data.overage_rate_per_message)} each, or fall back to SMS.`} />
      {data.schools.length === 0 ? <Card><Empty>No active or trial schools yet.</Empty></Card> : (
        <TableWrap>
          <THead cols={['School', 'Plan', 'Students', 'Branches', 'WhatsApp used', 'Alert', 'Last login']} />
          <tbody>
            {data.schools.map((s) => (
              <tr key={s.id}>
                <Td><Link to={`/platform/schools/${s.id}`} className="font-semibold text-[#2E2A6E] hover:underline">{s.name}</Link>{s.sender && <div className="text-[12px] text-[#6B7080]">Sender {s.sender}</div>}</Td>
                <Td><Pill tone={planTone[s.plan]}>{PLAN_LABEL[s.plan]}</Pill></Td>
                <Td>{num(s.students)}{s.student_limit ? <span className={s.over_student_limit ? 'font-semibold text-red-700' : 'text-[#6B7080]'}> / {num(s.student_limit)}</span> : ''}</Td>
                <Td>{s.branches}{s.branch_limit ? <span className="text-[#6B7080]"> / {s.branch_limit}</span> : ''}</Td>
                <Td className="w-56"><div className="flex items-center gap-2"><Meter percent={s.whatsapp_percent} level={s.whatsapp_level} /><span className="whitespace-nowrap text-[12.5px] text-[#5B6070]">{num(s.whatsapp_used)} / {num(s.whatsapp_limit)}</span></div></Td>
                <Td><Pill tone={tone[s.whatsapp_level]}>{label[s.whatsapp_level]}</Pill></Td>
                <Td>{s.last_login_at ? fmtDate(s.last_login_at) : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <p className="mt-4 text-[12.5px] text-[#6B7080]">Message counts and last-login times are filled in automatically once WhatsApp sending and the multi-school login are connected. Until then, enter the count on the school's Overview tab.</p>
    </>
  );
};
