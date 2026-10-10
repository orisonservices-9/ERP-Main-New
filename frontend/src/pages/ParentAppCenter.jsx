import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { Badge, Btn, Card, PageTitle, Table } from '../components/Shared';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Activity, ArrowRight, BadgeCheck, BellRing, BookOpenCheck, BusFront,
  Check, CheckCircle2, Clock3, CreditCard, Headphones,
  Loader2, MapPin, Megaphone, PhoneCall, Plus, RefreshCw,
  Route, Send, ShieldCheck, Smartphone, Sparkles, TicketCheck, UserRoundCheck,
  X, XCircle,
} from 'lucide-react';

const tabs = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'payments', label: 'Payment proofs', icon: CreditCard },
  { key: 'support', label: 'Help desk', icon: Headphones },
  { key: 'notices', label: 'Notices', icon: Megaphone },
  { key: 'hall', label: 'Hall tickets', icon: TicketCheck },
  { key: 'homework', label: 'Homework', icon: BookOpenCheck },
  { key: 'transport', label: 'Transport', icon: BusFront },
];

const initialNotice = {
  title: '', body: '', category: 'General', priority: 'Normal', issuer: 'School Office',
  target_type: 'All', class_name: '', section: '', status: 'Published',
};

const initialHallTicket = {
  title: '', class_name: '', section: '', venue: '', instructions: '',
  papersText: '', status: 'Draft', block_on_fee_due: true,
};

const initialRoute = {
  route_name: '', bus_number: '', driver_name: '', driver_mobile: '',
  attendant_name: '', stopsText: '', status: 'Active',
};

const initialTrip = {
  route_id: '', journey: 'Morning pickup', status: 'Boarding',
  current_stop: '', next_stop: '', eta_minutes: 10,
};

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const statusColor = (status = '') => {
  const value = status.toLowerCase();
  if (value.includes('approved') || value.includes('published') || value.includes('resolved') || value.includes('completed') || value.includes('route')) return 'green';
  if (value.includes('rejected') || value.includes('delayed')) return 'red';
  if (value.includes('pending') || value.includes('callback') || value.includes('review')) return 'amber';
  if (value.includes('open') || value.includes('scheduled') || value.includes('boarding')) return 'blue';
  return 'gray';
};

const EmptyState = ({ icon: Icon, title, copy }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="h-6 w-6" /></div>
    <p className="text-[14px] font-semibold text-slate-800">{title}</p>
    <p className="mt-1 max-w-sm text-[12px] leading-5 text-slate-400">{copy}</p>
  </div>
);

const Metric = ({ icon: Icon, label, value, copy, tone = 'red' }) => {
  const tones = {
    red: 'from-indigo-50 to-rose-50 text-[#4F46E5] border-indigo-100',
    blue: 'from-blue-50 to-indigo-50 text-blue-700 border-blue-100',
    green: 'from-emerald-50 to-teal-50 text-emerald-700 border-emerald-100',
    amber: 'from-amber-50 to-orange-50 text-amber-700 border-amber-100',
    purple: 'from-purple-50 to-fuchsia-50 text-purple-700 border-purple-100',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{label}</span><Icon className="h-4 w-4" /></div>
      <p className="mt-3 font-poppins text-[26px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-[10px] text-slate-500">{copy}</p>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block text-[11px] font-semibold text-slate-600">
    {label}
    <div className="mt-1.5">{children}</div>
  </label>
);

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50';
const areaClass = 'min-h-[108px] w-full rounded-xl border border-slate-200 bg-white p-3 text-[12px] text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50';

const ParentAppCenter = () => {
  const { auth } = useAuth();
  const role = auth?.role || 'admin';
  const canFinance = ['admin', 'director', 'fee_manager'].includes(role);
  const canAcademic = ['admin', 'principal', 'director', 'academic_coordinator'].includes(role);
  const canTransport = ['admin', 'principal', 'director'].includes(role);
  const visibleTabs = useMemo(() => tabs.filter((tab) => {
    if (tab.key === 'payments') return canFinance;
    if (['support', 'notices', 'hall', 'homework'].includes(tab.key)) return canAcademic;
    if (tab.key === 'transport') return canTransport;
    return true;
  }), [canAcademic, canFinance, canTransport]);
  const [active, setActive] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState({
    summary: {}, payments: [], support: [], notices: [], hall: [], completions: [], routes: [], trips: [],
  });
  const [notice, setNotice] = useState(initialNotice);
  const [hallTicket, setHallTicket] = useState(initialHallTicket);
  const [routeForm, setRouteForm] = useState(initialRoute);
  const [tripForm, setTripForm] = useState(initialTrip);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const empty = Promise.resolve({ data: [] });
      const [summary, payments, support, notices, hall, completions, routes, trips] = await Promise.all([
        api.get('/parent-center/summary'), canFinance ? api.get('/parent-center/payment-proofs') : empty,
        canAcademic ? api.get('/parent-center/help-requests') : empty,
        canAcademic ? api.get('/parent-center/notices') : empty,
        canAcademic ? api.get('/parent-center/hall-tickets') : empty,
        canAcademic ? api.get('/parent-center/homework-completions') : empty,
        canTransport ? api.get('/parent-center/transport/routes') : empty,
        canTransport ? api.get('/parent-center/transport/trips') : empty,
      ]);
      setData({
        summary: summary.data, payments: payments.data, support: support.data,
        notices: notices.data, hall: hall.data, completions: completions.data,
        routes: routes.data, trips: trips.data,
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Could not load the Parent App Control Center.');
    } finally { setLoading(false); }
  }, [canAcademic, canFinance, canTransport]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (action, success) => {
    setSaving(true); setError(''); setMessage('');
    try { await action(); setMessage(success); await load(); }
    catch (requestError) { setError(requestError?.response?.data?.detail || 'The action could not be completed.'); }
    finally { setSaving(false); }
  };

  const reviewPayment = (id, status) => runAction(
    () => api.put(`/parent-center/payment-proofs/${id}/status`, { status }),
    `Payment proof ${status.toLowerCase()} successfully.`,
  );

  const updateSupport = (id, status) => runAction(
    () => api.put(`/parent-center/help-requests/${id}`, { status, assigned_to: status === 'Resolved' ? 'Orison Support' : 'Parent Relations Desk' }),
    `Support request moved to ${status}.`,
  );

  const publishExistingNotice = (id) => runAction(
    () => api.put(`/parent-center/notices/${id}`, { status: 'Published' }),
    'Notice published to eligible parents.',
  );

  const submitNotice = (event) => {
    event.preventDefault();
    runAction(() => api.post('/parent-center/notices', notice), 'Parent notice created successfully.');
    setNotice(initialNotice);
  };

  const submitHallTicket = (event) => {
    event.preventDefault();
    const papers = hallTicket.papersText.split('\n').map((line) => {
      const [date, subject, time] = line.split('|').map((value) => value?.trim());
      return { date, subject, time };
    }).filter((paper) => paper.date && paper.subject && paper.time);
    const payload = { ...hallTicket, papers };
    delete payload.papersText;
    runAction(() => api.post('/parent-center/hall-tickets', payload), 'Hall ticket schedule saved.');
    setHallTicket(initialHallTicket);
  };

  const publishHallTicket = (id) => runAction(
    () => api.put(`/parent-center/hall-tickets/${id}`, { status: 'Published' }),
    'Hall ticket published to eligible students.',
  );

  const submitRoute = (event) => {
    event.preventDefault();
    const stops = routeForm.stopsText.split('\n').map((line) => {
      const [name, time] = line.split('|').map((value) => value?.trim());
      return { name, time };
    }).filter((stop) => stop.name && stop.time);
    const payload = { ...routeForm, stops, student_ids: [] };
    delete payload.stopsText;
    runAction(() => api.post('/parent-center/transport/routes', payload), 'Transport route saved.');
    setRouteForm(initialRoute);
  };

  const submitTrip = (event) => {
    event.preventDefault();
    runAction(() => api.post('/parent-center/transport/trips', { ...tripForm, eta_minutes: Number(tripForm.eta_minutes) }), 'Live trip status updated.');
  };

  const pendingPayments = useMemo(() => data.payments.filter((item) => item.status === 'Pending Review'), [data.payments]);
  const openSupport = useMemo(() => data.support.filter((item) => !['Resolved', 'Closed'].includes(item.status)), [data.support]);

  return (
    <Layout>
      <PageTitle
        title="Parent App Control Center"
        subtitle="Operate every parent-facing workflow from one secure command center."
        actions={<Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh live data</Btn>}
      />

      <div className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#171923] via-[#34223a] to-[#8f253a] p-6 text-white shadow-[0_20px_55px_rgba(85,31,52,0.2)]">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-purple-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-rose-100"><Sparkles className="h-3.5 w-3.5" /> Premium parent operations</div>
            <h2 className="font-poppins text-[27px] font-bold leading-tight">One school. Every parent moment, connected.</h2>
            <p className="mt-2 max-w-xl text-[12px] leading-6 text-white/60">Review money safely, publish trusted information, respond to families, monitor homework and run transport without switching between modules.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [Smartphone, data.summary.parents || 0, 'Active parents'],
              [Clock3, data.summary.pending_payments || 0, 'Proofs waiting'],
              [Headphones, data.summary.open_tickets || 0, 'Open requests'],
              [BellRing, data.summary.queued_notifications || 0, 'Alerts queued'],
            ].map(([Icon, value, label]) => (
              <div key={label} className="min-w-[112px] rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-3 backdrop-blur">
                <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-rose-200" /><span className="font-poppins text-xl font-bold">{value}</span></div>
                <p className="mt-2 text-[8px] uppercase tracking-wide text-white/[0.45]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`mb-5 flex items-center justify-between rounded-2xl border px-4 py-3 text-[12px] ${error ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          <span className="flex items-center gap-2">{error ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{error || message}</span>
          <button onClick={() => { setError(''); setMessage(''); }}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = active === tab.key;
            return <button key={tab.key} onClick={() => setActive(tab.key)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-semibold transition ${selected ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon className="h-4 w-4" />{tab.label}</button>;
          })}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" /></div> : <>
        {active === 'overview' && <Overview data={data} pendingPayments={pendingPayments} openSupport={openSupport} onOpen={setActive} />}
        {active === 'payments' && <Payments items={data.payments} saving={saving} onReview={reviewPayment} />}
        {active === 'support' && <Support items={data.support} saving={saving} onUpdate={updateSupport} />}
        {active === 'notices' && <Notices items={data.notices} form={notice} setForm={setNotice} onSubmit={submitNotice} onPublish={publishExistingNotice} saving={saving} />}
        {active === 'hall' && <HallTickets items={data.hall} form={hallTicket} setForm={setHallTicket} onSubmit={submitHallTicket} onPublish={publishHallTicket} saving={saving} />}
        {active === 'homework' && <HomeworkUpdates items={data.completions} />}
        {active === 'transport' && <TransportOps routes={data.routes} trips={data.trips} routeForm={routeForm} setRouteForm={setRouteForm} tripForm={tripForm} setTripForm={setTripForm} onRoute={submitRoute} onTrip={submitTrip} saving={saving} />}
      </>}
    </Layout>
  );
};

const Overview = ({ data, pendingPayments, openSupport, onOpen }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric icon={CreditCard} label="Payment proofs" value={pendingPayments.length} copy="Awaiting finance review" tone="amber" />
      <Metric icon={PhoneCall} label="Parent requests" value={openSupport.length} copy="Callbacks and app support" tone="purple" />
      <Metric icon={Megaphone} label="Published notices" value={data.summary.published_notices || 0} copy="Visible in the parent app" tone="blue" />
      <Metric icon={BusFront} label="Active trips" value={data.summary.active_trips || 0} copy="Live transport journeys" tone="green" />
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <Card title="Action queue" subtitle="The work that needs attention first." className="xl:col-span-2">
        <div className="space-y-3">
          {[
            { icon: CreditCard, color: 'bg-amber-50 text-amber-700', title: `${pendingPayments.length} payment proof${pendingPayments.length === 1 ? '' : 's'} waiting`, copy: 'Verify the transaction before updating the fee ledger.', tab: 'payments' },
            { icon: Headphones, color: 'bg-purple-50 text-purple-700', title: `${openSupport.length} open family request${openSupport.length === 1 ? '' : 's'}`, copy: 'Schedule callbacks and resolve parent app issues.', tab: 'support' },
            { icon: TicketCheck, color: 'bg-blue-50 text-blue-700', title: `${data.summary.published_hall_tickets || 0} hall-ticket schedule published`, copy: 'Fee eligibility is checked separately for every student.', tab: 'hall' },
          ].map((item) => {
            const Icon = item.icon;
            return <button key={item.tab} onClick={() => onOpen(item.tab)} className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/20"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.color}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-slate-800">{item.title}</span><span className="mt-1 block text-[10px] text-slate-400">{item.copy}</span></span><ArrowRight className="h-4 w-4 text-slate-300" /></button>;
          })}
        </div>
      </Card>
      <Card title="Connection readiness" subtitle="Prepared services for the parent channel.">
        <div className="space-y-4">
          {[
            ['Parent ownership & OTP', true], ['Fees and receipts', true],
            ['Notices and read status', true], ['Homework completion', true],
            ['Live transport status', true], ['Push delivery provider', false],
          ].map(([label, ready]) => <div key={label} className="flex items-center justify-between"><span className="text-[11px] text-slate-600">{label}</span>{ready ? <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600"><Check className="h-3.5 w-3.5" /> READY</span> : <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600"><Clock3 className="h-3.5 w-3.5" /> PROVIDER</span>}</div>)}
        </div>
      </Card>
    </div>
  </div>
);

const Payments = ({ items, saving, onReview }) => (
  <Card title="Payment proof verification" subtitle="Only approval posts money to the fee ledger and creates a receipt." pad="p-0">
    {items.length === 0 ? <EmptyState icon={CreditCard} title="No payment proofs" copy="Parent submissions will appear here for secure finance review." /> : <div className="overflow-x-auto"><Table columns={[{ label: 'Parent / Student' }, { label: 'Transaction' }, { label: 'Amount' }, { label: 'Submitted' }, { label: 'Status' }, { label: 'Decision' }]}>
      {items.map((item) => <tr key={item.id} className="border-b border-slate-50 last:border-0">
        <td className="px-6 py-4"><p className="text-[12px] font-semibold text-slate-800">{item.student_name}</p><p className="text-[10px] text-slate-400">{item.parent_name} · {item.class_name} {item.section}</p></td>
        <td className="py-4"><p className="font-mono text-[11px] font-semibold text-slate-700">{item.transaction_id}</p><p className="text-[9px] text-slate-400">{item.proof_name || 'No filename'}</p></td>
        <td className="py-4 text-[13px] font-bold text-slate-900">{money(item.amount)}</td>
        <td className="py-4 text-[10px] text-slate-500">{formatDate(item.submitted_at)}</td>
        <td className="py-4"><Badge color={statusColor(item.status)}>{item.status}</Badge></td>
        <td className="py-4 pr-6">{item.status === 'Pending Review' ? <div className="flex gap-2"><button disabled={saving} onClick={() => onReview(item.id, 'Approved')} className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100">Approve</button><button disabled={saving} onClick={() => onReview(item.id, 'Rejected')} className="rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100">Reject</button></div> : <span className="text-[10px] text-slate-400">Reviewed {item.reviewed_by ? `by ${item.reviewed_by}` : ''}</span>}</td>
      </tr>)}
    </Table></div>}
  </Card>
);

const Support = ({ items, saving, onUpdate }) => (
  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
    {items.length === 0 ? <div className="xl:col-span-2"><Card><EmptyState icon={Headphones} title="No parent requests" copy="School callbacks and Orison app tickets will appear here." /></Card></div> : items.map((item) => (
      <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.kind === 'School callback' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{item.kind === 'School callback' ? <PhoneCall className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[13px] font-bold text-slate-900">{item.category}</p><Badge color={statusColor(item.status)}>{item.status}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{item.kind} · {item.id}</p></div></div>
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-[11px] leading-5 text-slate-600">{item.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]"><div><p className="text-slate-400">Parent</p><p className="mt-1 font-semibold text-slate-700">{item.parent_name}</p><p className="text-slate-500">+91 {item.mobile}</p></div><div><p className="text-slate-400">Student / preferred time</p><p className="mt-1 font-semibold text-slate-700">{item.student_name}</p><p className="text-slate-500">{item.preferred_time || 'Any time'}</p></div></div>
        {!['Resolved', 'Closed'].includes(item.status) && <div className="mt-5 flex gap-2"><button disabled={saving} onClick={() => onUpdate(item.id, 'Scheduled')} className="flex-1 rounded-xl border border-blue-100 bg-blue-50 py-2.5 text-[10px] font-bold text-blue-700">Schedule</button><button disabled={saving} onClick={() => onUpdate(item.id, 'Resolved')} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-[10px] font-bold text-white">Resolve</button></div>}
      </div>
    ))}
  </div>
);

const Notices = ({ items, form, setForm, onSubmit, onPublish, saving }) => (
  <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
    <Card title="Create parent notice" subtitle="Target the whole school or one class and section." className="xl:col-span-2 self-start">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Notice title"><input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What should parents know?" /></Field>
        <Field label="Message"><textarea required className={areaClass} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write a clear parent-facing announcement…" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Category"><select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['General', 'Academics', 'Fees', 'Events', 'Transport'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Priority"><select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{['Normal', 'Important', 'Urgent'].map((value) => <option key={value}>{value}</option>)}</select></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Audience"><select className={inputClass} value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value })}><option>All</option><option>Class</option></select></Field><Field label="Publish"><select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Published</option><option>Draft</option></select></Field></div>
        {form.target_type === 'Class' && <div className="grid grid-cols-2 gap-3"><Field label="Class"><input required className={inputClass} value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="Grade 11" /></Field><Field label="Section"><input required className={inputClass} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Section B" /></Field></div>}
        <Btn type="submit" icon={Send} disabled={saving} className="w-full">{form.status === 'Published' ? 'Publish to parents' : 'Save draft'}</Btn>
      </form>
    </Card>
    <Card title="Parent notice library" subtitle={`${items.length} school announcement${items.length === 1 ? '' : 's'}`} className="xl:col-span-3" pad="p-3">
      <div className="space-y-3">{items.length === 0 ? <EmptyState icon={Megaphone} title="No parent notices" copy="Create your first targeted school announcement." /> : items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]"><Megaphone className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[12px] font-bold text-slate-900">{item.title}</p><Badge color={statusColor(item.status)}>{item.status}</Badge><Badge color={item.priority === 'Urgent' ? 'red' : 'blue'}>{item.priority}</Badge></div><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500">{item.body}</p><p className="mt-2 text-[9px] text-slate-400">{item.issuer} · {item.target_type === 'All' ? 'All parents' : `${item.class_name} ${item.section}`} · {formatDate(item.published_at || item.created)}</p></div>{item.status === 'Draft' && <button onClick={() => onPublish(item.id)} className="rounded-lg bg-slate-900 px-3 py-2 text-[9px] font-bold text-white">Publish</button>}</div></div>)}</div>
    </Card>
  </div>
);

const HallTickets = ({ items, form, setForm, onSubmit, onPublish, saving }) => (
  <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
    <Card title="Prepare hall ticket" subtitle="Create the official subject schedule and fee rule." className="xl:col-span-2 self-start">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Examination"><input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Unit Test III" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Class"><input required className={inputClass} value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="Grade 11" /></Field><Field label="Section"><input required className={inputClass} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Section B" /></Field></div>
        <Field label="Venue"><input required className={inputClass} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Senior Wing · Hall B" /></Field>
        <Field label="Papers — one per line: date | subject | time"><textarea required className={areaClass} value={form.papersText} onChange={(e) => setForm({ ...form, papersText: e.target.value })} placeholder={'2026-09-18 | Mathematics | 09:00 – 10:30 AM\n2026-09-19 | English | 09:00 – 10:30 AM'} /></Field>
        <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3 text-[10px] font-semibold text-amber-800"><input type="checkbox" checked={form.block_on_fee_due} onChange={(e) => setForm({ ...form, block_on_fee_due: e.target.checked })} className="accent-[#4F46E5]" /> Block generation when tuition fees are due</label>
        <div className="grid grid-cols-2 gap-3"><select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Draft</option><option>Published</option></select><Btn type="submit" icon={TicketCheck} disabled={saving}>Save schedule</Btn></div>
      </form>
    </Card>
    <div className="space-y-4 xl:col-span-3">{items.length === 0 ? <Card><EmptyState icon={TicketCheck} title="No hall tickets" copy="Create an examination schedule for parents." /></Card> : items.map((item) => <div key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="bg-gradient-to-r from-slate-900 to-slate-700 p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/[0.45]">Official examination access</p><h3 className="mt-2 font-poppins text-[19px] font-bold">{item.title}</h3><p className="mt-1 text-[10px] text-white/[0.55]">{item.class_name} · {item.section} · {item.venue}</p></div><Badge color={statusColor(item.status)}>{item.status}</Badge></div></div><div className="p-5"><div className="space-y-2">{(item.papers || []).map((paper, index) => <div key={`${paper.date}-${paper.subject}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-[#4F46E5] shadow-sm">{index + 1}</span><div className="flex-1"><p className="text-[11px] font-semibold text-slate-800">{paper.subject}</p><p className="text-[9px] text-slate-400">{paper.date} · {paper.time}</p></div></div>)}</div><div className="mt-4 flex items-center justify-between"><span className="flex items-center gap-2 text-[9px] font-semibold text-amber-700"><ShieldCheck className="h-4 w-4" />{item.block_on_fee_due ? 'Fee eligibility enforced' : 'No fee block'}</span>{item.status === 'Draft' && <button onClick={() => onPublish(item.id)} className="rounded-xl bg-[#4F46E5] px-4 py-2.5 text-[9px] font-bold text-white">Publish ticket</button>}</div></div></div>)}</div>
  </div>
);

const HomeworkUpdates = ({ items }) => {
  const complete = items.filter((item) => item.completed).length;
  return <div className="space-y-5"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={BookOpenCheck} label="Parent updates" value={items.length} copy="Student-level responses" tone="blue" /><Metric icon={BadgeCheck} label="Marked done" value={complete} copy="Confirmed by parents" tone="green" /><Metric icon={Clock3} label="Pending" value={items.length - complete} copy="Still requiring work" tone="amber" /><Metric icon={UserRoundCheck} label="Completion rate" value={`${items.length ? Math.round(complete / items.length * 100) : 0}%`} copy="Across received updates" tone="purple" /></div><Card title="Student homework status" subtitle="The teacher and admin can see every parent completion update." pad="p-0">{items.length === 0 ? <EmptyState icon={BookOpenCheck} title="No completion updates" copy="Parent Done/Pending actions will appear here." /> : <div className="overflow-x-auto"><Table columns={[{ label: 'Student' }, { label: 'Subject / Homework' }, { label: 'Parent update' }, { label: 'Updated' }, { label: 'Status' }]}>{items.map((item) => <tr key={item.id} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4 text-[12px] font-semibold text-slate-800">{item.student_name}</td><td className="py-4"><p className="text-[11px] font-semibold text-slate-700">{item.subject}</p><p className="text-[9px] text-slate-400">{item.homework_id}</p></td><td className="py-4 text-[10px] text-slate-500">{item.updated_by_parent || 'Verified parent'}</td><td className="py-4 text-[10px] text-slate-500">{formatDate(item.updated)}</td><td className="py-4 pr-6"><Badge color={item.completed ? 'green' : 'amber'}>{item.completed ? 'Done' : 'Pending'}</Badge></td></tr>)}</Table></div>}</Card></div>;
};

const TransportOps = ({ routes, trips, routeForm, setRouteForm, tripForm, setTripForm, onRoute, onTrip, saving }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card title="Add transport route" subtitle="Bus, crew and ordered parent stop points.">
        <form onSubmit={onRoute} className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field label="Route name"><input required className={inputClass} value={routeForm.route_name} onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })} placeholder="Route 12 · Jubilee Hills" /></Field><Field label="Bus number"><input className={inputClass} value={routeForm.bus_number} onChange={(e) => setRouteForm({ ...routeForm, bus_number: e.target.value })} placeholder="TS 09 AB 2042" /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Driver"><input className={inputClass} value={routeForm.driver_name} onChange={(e) => setRouteForm({ ...routeForm, driver_name: e.target.value })} /></Field><Field label="Driver mobile"><input className={inputClass} value={routeForm.driver_mobile} onChange={(e) => setRouteForm({ ...routeForm, driver_mobile: e.target.value })} /></Field></div><Field label="Stops — one per line: name | time"><textarea required className={areaClass} value={routeForm.stopsText} onChange={(e) => setRouteForm({ ...routeForm, stopsText: e.target.value })} placeholder={'School bus depot | 06:50\nCentral Park Stop | 07:18'} /></Field><Btn type="submit" icon={Plus} disabled={saving} className="w-full">Save route</Btn></form>
      </Card>
      <Card title="Update live journey" subtitle="Parents immediately receive stop and ETA changes.">
        <form onSubmit={onTrip} className="space-y-4"><Field label="Route"><select required className={inputClass} value={tripForm.route_id} onChange={(e) => setTripForm({ ...tripForm, route_id: e.target.value })}><option value="">Choose route</option>{routes.map((item) => <option key={item.id} value={item.id}>{item.route_name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Journey"><select className={inputClass} value={tripForm.journey} onChange={(e) => setTripForm({ ...tripForm, journey: e.target.value })}><option>Morning pickup</option><option>Evening drop</option></select></Field><Field label="Status"><select className={inputClass} value={tripForm.status} onChange={(e) => setTripForm({ ...tripForm, status: e.target.value })}>{['Boarding', 'On Route', 'Delayed', 'Completed'].map((value) => <option key={value}>{value}</option>)}</select></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Current stop"><input className={inputClass} value={tripForm.current_stop} onChange={(e) => setTripForm({ ...tripForm, current_stop: e.target.value })} /></Field><Field label="Next stop"><input className={inputClass} value={tripForm.next_stop} onChange={(e) => setTripForm({ ...tripForm, next_stop: e.target.value })} /></Field></div><Field label="ETA in minutes"><input type="number" min="0" className={inputClass} value={tripForm.eta_minutes} onChange={(e) => setTripForm({ ...tripForm, eta_minutes: e.target.value })} /></Field><Btn type="submit" icon={Send} disabled={saving} className="w-full">Push live update</Btn></form>
      </Card>
    </div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">{routes.map((routeItem) => { const trip = trips.find((item) => item.route_id === routeItem.id); return <div key={routeItem.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><BusFront className="h-5 w-5" /></span><Badge color={statusColor(trip?.status || routeItem.status)}>{trip?.status || routeItem.status}</Badge></div><h3 className="mt-4 text-[14px] font-bold text-slate-900">{routeItem.route_name}</h3><p className="mt-1 text-[10px] text-slate-400">{routeItem.bus_number || 'Bus not assigned'} · {routeItem.driver_name || 'Driver not assigned'}</p><div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white"><div className="flex items-center gap-2 text-[9px] text-white/50"><MapPin className="h-3.5 w-3.5" /> LIVE JOURNEY</div><p className="mt-2 text-[12px] font-semibold">{trip?.current_stop || 'No active journey'}</p>{trip && <p className="mt-1 text-[9px] text-emerald-300">Next: {trip.next_stop} · ETA {trip.eta_minutes} min</p>}</div><div className="mt-4 flex items-center justify-between text-[9px] text-slate-400"><span className="flex items-center gap-1"><Route className="h-3.5 w-3.5" />{(routeItem.stops || []).length} stops</span><span>{(routeItem.student_ids || []).length} students linked</span></div></div>; })}</div>
  </div>
);

export default ParentAppCenter;
