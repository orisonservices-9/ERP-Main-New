import React, { useCallback, useEffect, useState } from 'react';
import { Bug, CheckCircle2, ChevronDown, CircleHelp, Clock3, Headset, Hourglass, Lightbulb, Loader2, ShieldCheck, Send, TicketCheck } from 'lucide-react';
import Layout from '../components/Layout';
import { notify } from '../components/AppFeedback';
import api from '../api';

// The staff help desk: every login can ask the Orison team for help or report an error.
// Same design as the Help desk in the Orison parent app.
const SERVICES = [
  { type: 'Help needed', icon: CircleHelp, color: '#3157C8', title: 'I need help', sub: 'Ask how to do something or get unstuck', form: 'Ask the Orison team', formSub: 'Tell us what you are trying to do and where you are stuck.' },
  { type: 'Error / bug', icon: Bug, color: '#8A43C6', title: 'Report an error', sub: 'Something is not working or shows an error', form: 'Raise an Orison support ticket', formSub: 'Tell our technical team where you are facing a problem.' },
  { type: 'Suggestion', icon: Lightbulb, color: '#07966C', title: 'Suggest an idea', sub: 'Tell us what would make Orison better', form: 'Share an improvement', formSub: 'What should work differently, or what is missing?' },
];
const PRIORITY = { Low: '#07966C', Normal: '#8A43C6', Urgent: '#D14A45' };
const statusStyle = (status) => (status === 'Resolved' || status === 'Closed' ? '#07966C' : status === 'Waiting for school' ? '#3157C8' : '#D57912');
const statusText = (status) => (status === 'Waiting for school' ? 'Needs your reply' : status);
const when = (iso) => {
  const d = new Date(`${iso}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100';
const cameFrom = () => {
  try { const u = new URL(document.referrer); return u.origin === window.location.origin && u.pathname !== '/support' ? u.pathname : ''; } catch { return ''; }
};

const FormShell = ({ color, icon: Icon, title, subtitle, children }) => (
  <div className="rounded-[23px] border bg-white p-[18px] shadow-[0_7px_15px_rgba(0,0,0,0.03)]" style={{ borderColor: `${color}33` }}>
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}1A`, color }}><Icon className="h-5 w-5" /></span>
      <div><p className="text-[15px] font-bold text-slate-900">{title}</p><p className="text-[12px] text-slate-500">{subtitle}</p></div>
    </div>
    {children}
  </div>
);

const Summary = ({ icon: Icon, value, label, color }) => (
  <div className="rounded-[17px] border bg-white px-3 py-3.5" style={{ borderColor: `${color}2E` }}>
    <Icon className="h-5 w-5" style={{ color }} />
    <p className="mt-2 text-[24px] font-bold leading-none" style={{ color }}>{value}</p>
    <p className="mt-1 text-[12px] font-semibold text-slate-500">{label}</p>
  </div>
);

const RequestCard = ({ item, open, onToggle, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const svc = SERVICES.find((s) => s.type === item.type) || SERVICES[0];
  const Icon = svc.icon;
  const color = statusStyle(item.status);

  const loadDetail = useCallback(async () => {
    try { setDetail((await api.get(`/support/tickets/${item.id}`)).data); } catch { /* shown as empty */ }
  }, [item.id]);
  useEffect(() => { if (open) loadDetail(); }, [open, loadDetail, item.updated_at]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try { await api.post(`/support/tickets/${item.id}/reply`, { text: reply.trim() }); setReply(''); await loadDetail(); onChanged(); }
    catch (err) { notify(err.response?.data?.detail || 'Could not send your message.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`mb-3 rounded-[20px] border bg-white p-4 transition ${item.status === 'Waiting for school' ? 'border-[#3157C8]/40' : 'border-slate-200'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2.5 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${svc.color}17`, color: svc.color }}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-slate-900">{item.subject}</span>
          <span className="block truncate text-[12px] text-slate-500">{item.type} · {item.id}{item.feature_label ? ` · ${item.feature_label}` : ''}</span>
        </span>
        <span className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ background: `${color}1A`, color }}>{statusText(item.status)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-slate-500"><Clock3 className="h-3.5 w-3.5" />{when(item.created_at)}{item.messages > 0 && <span className="ml-3">{item.messages} message{item.messages === 1 ? '' : 's'}</span>}</div>
      {open && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {!detail ? <p className="text-[13px] text-slate-500"><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Loading…</p> : (<>
            <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-slate-700">{detail.description}</p>
            {detail.error_details && <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[12px] leading-5 text-slate-100">{detail.error_details}</pre>}
            {detail.thread.length > 0 && (
              <ul className="space-y-2">
                {detail.thread.map((m) => (
                  <li key={m.id} className={`rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-6 ${m.from === 'orison' ? 'bg-violet-50 text-slate-800' : 'ml-8 bg-slate-100 text-slate-800'}`}>
                    <p className="mb-0.5 text-[11.5px] font-bold" style={{ color: m.from === 'orison' ? '#6D3FA8' : '#64748B' }}>{m.from === 'orison' ? `Orison support · ${m.author}` : 'You'} · {when(m.at)}</p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {item.status === 'Waiting for school' && <p className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-[12.5px] font-semibold text-blue-800"><Hourglass className="h-4 w-4" />Orison is waiting for your reply.</p>}
            {item.status !== 'Closed' ? (
              <div className="flex items-end gap-2">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={item.status === 'Resolved' ? 'Not fixed? Reply here and we will reopen it.' : 'Write a reply…'} className={`${field} flex-1`} />
                <button type="button" onClick={send} disabled={busy || !reply.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#8A43C6] px-4 text-[13px] font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send</button>
              </div>
            ) : <p className="text-[12.5px] text-slate-500">This request is closed. Raise a new request if you still need help.</p>}
          </>)}
        </div>
      )}
    </div>
  );
};

const SupportDesk = () => {
  const [meta, setMeta] = useState(null);
  const [list, setList] = useState(null);
  const [service, setService] = useState(0);
  const [form, setForm] = useState({ category: '', feature: '', priority: 'Normal', subject: '', description: '', error_details: '', page: cameFrom() });
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([api.get('/support/meta'), api.get('/support/tickets')]);
      setMeta(m.data); setList(l.data);
      setForm((f) => ({ ...f, category: f.category || m.data.categories[0] }));
    } catch (err) { setError(err.response?.data?.detail || 'The help desk could not be loaded. Please try again.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const svc = SERVICES[service];
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async () => {
    if (form.subject.trim().length < 3) return notify('Give your request a short title.', 'error');
    if (form.description.trim().length < 10) return notify('Please explain in at least 10 characters.', 'error');
    setBusy(true);
    try {
      const { data } = await api.post('/support/tickets', { ...form, type: svc.type, error_details: svc.type === 'Error / bug' ? form.error_details : '' });
      notify('Request sent. Orison support will reply here.', 'success');
      setForm((f) => ({ ...f, subject: '', description: '', error_details: '', priority: 'Normal' }));
      await load(); setOpenId(data.id);
    } catch (err) { notify(err.response?.data?.detail || 'Your request could not be sent. Please try again.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl pb-10" data-testid="support-desk">
        <div className="mb-5 flex items-center gap-3.5 rounded-[27px] p-5 text-white shadow-[0_11px_24px_rgba(69,70,139,0.23)]" style={{ background: 'linear-gradient(135deg,#1E2440,#3E4389,#7850B5)' }}>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10"><Headset className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/60">Orison support</p>
            <h1 className="font-poppins text-[22px] font-extrabold leading-tight">We’re here to help</h1>
            <p className="text-[12.5px] text-white/75">Ask for help or report a problem. The Orison team replies here.</p>
          </div>
          <ShieldCheck className="hidden h-6 w-6 text-[#D2C2FF] sm:block" />
        </div>

        {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">{error}</p> : !meta ? <p className="py-16 text-center text-slate-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Loading…</p> : (<>
          <h2 className="font-poppins text-[18px] font-extrabold text-slate-900">How can we help?</h2>
          <p className="mb-3 mt-0.5 text-[12.5px] text-slate-500">Select what you need</p>
          <div className="mb-4 grid gap-2.5 sm:grid-cols-3">
            {SERVICES.map((s, i) => {
              const Icon = s.icon; const on = service === i;
              return (
                <button key={s.type} type="button" onClick={() => setService(i)} aria-pressed={on} className="rounded-[19px] border p-3.5 text-left transition" style={{ borderColor: on ? s.color : '#E1E3E8', background: on ? `${s.color}14` : '#fff', borderWidth: on ? 1.5 : 1 }}>
                  <span className="mb-2.5 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: `${s.color}1A`, color: s.color }}><Icon className="h-5 w-5" /></span><span className="h-4 w-4 rounded-full border-2" style={{ borderColor: on ? s.color : '#B4BBC4', background: on ? s.color : 'transparent', boxShadow: on ? 'inset 0 0 0 3px #fff' : 'none' }} /></span>
                  <p className="text-[13.5px] font-bold text-slate-900">{s.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{s.sub}</p>
                </button>
              );
            })}
          </div>

          <FormShell color={svc.color} icon={svc.icon} title={svc.form} subtitle={svc.formSub}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-[12.5px] font-bold text-slate-700">Where is it?</span>
                <select value={form.category} onChange={set('category')} className={field}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-[12.5px] font-bold text-slate-700">Which feature?</span>
                <select value={form.feature} onChange={set('feature')} className={field}><option value="">Not sure</option>{meta.features.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
            </div>
            <p className="mb-1.5 mt-4 text-[12.5px] font-bold text-slate-700">How urgent is it?</p>
            <div className="grid grid-cols-3 gap-2">
              {meta.priorities.map((p) => {
                const on = form.priority === p;
                return <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, priority: p }))} aria-pressed={on} className="rounded-xl border py-2 text-[12px] font-extrabold transition" style={{ borderColor: on ? PRIORITY[p] : '#E1E3E8', background: on ? `${PRIORITY[p]}1A` : '#F8F9FB', color: on ? PRIORITY[p] : '#64748B' }}>{p}</button>;
              })}
            </div>
            <label className="mt-4 block"><span className="mb-1 block text-[12.5px] font-bold text-slate-700">Short title</span>
              <input value={form.subject} onChange={set('subject')} maxLength={120} placeholder={svc.type === 'Error / bug' ? 'e.g. Receipt shows the wrong total' : svc.type === 'Suggestion' ? 'e.g. Add an Excel export' : 'e.g. How do I mark a student late?'} className={field} /></label>
            <label className="mt-3.5 block"><span className="mb-1 block text-[12.5px] font-bold text-slate-700">{svc.type === 'Error / bug' ? 'What happened, and what were you trying to do?' : svc.type === 'Suggestion' ? 'Describe your idea' : 'Tell us what you need'}</span>
              <textarea value={form.description} onChange={set('description')} rows={5} maxLength={4000} className={field} /></label>
            {svc.type === 'Error / bug' && (
              <label className="mt-3.5 block"><span className="mb-1 block text-[12.5px] font-bold text-slate-700">Error message <span className="font-medium text-slate-400">(if you saw one; copy and paste it)</span></span>
                <textarea value={form.error_details} onChange={set('error_details')} rows={3} maxLength={4000} className={`${field} font-mono text-[12.5px]`} /></label>
            )}
            <label className="mt-3.5 block"><span className="mb-1 block text-[12.5px] font-bold text-slate-700">Which screen were you on? <span className="font-medium text-slate-400">(optional)</span></span>
              <input value={form.page} onChange={set('page')} maxLength={200} placeholder="e.g. Fee Management > Collect Fee" className={field} /></label>
            <button type="button" onClick={submit} disabled={busy} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white transition disabled:opacity-60" style={{ background: svc.color }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketCheck className="h-[18px] w-[18px]" />}Raise support ticket
            </button>
          </FormShell>

          <h2 className="mb-3 mt-7 font-poppins text-[18px] font-extrabold text-slate-900">Support overview</h2>
          <div className="grid grid-cols-3 gap-2.5">
            <Summary icon={Clock3} value={list?.counts.active ?? 0} label="Active" color="#D57912" />
            <Summary icon={Hourglass} value={list?.counts.waiting ?? 0} label="Needs your reply" color="#3157C8" />
            <Summary icon={CheckCircle2} value={list?.counts.resolved ?? 0} label="Resolved" color="#07966C" />
          </div>

          <div className="mb-3 mt-7 flex items-end justify-between"><h2 className="font-poppins text-[18px] font-extrabold text-slate-900">Your requests</h2><span className="text-[12px] text-slate-500">{list?.items.length ?? 0} total</span></div>
          {list && list.items.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-[13.5px] text-slate-500">No requests yet. Anything you raise will appear here with the replies.</p>
            : list?.items.map((item) => <RequestCard key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? '' : item.id)} onChanged={load} />)}

          <div className="mt-2 flex items-center gap-2 rounded-[17px] bg-[#EAF4F7] p-3.5 text-[12px] leading-5 text-[#466573]"><Clock3 className="h-[19px] w-[19px] shrink-0 text-[#32677A]" />Help desk hours: {meta.hours}</div>
        </>)}
      </div>
    </Layout>
  );
};

export default SupportDesk;
