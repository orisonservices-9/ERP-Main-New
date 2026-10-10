import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, Card, Btn, Badge, Field, Table } from '../../components/Shared';
import { CONVERSATIONS } from '../../mock2';
import { Send, Search, Loader2, BellRing, RefreshCw, Smartphone, GraduationCap, ShieldCheck, FileCheck2, History, Paperclip, X, Clock3, Building2, Gavel, UserRound, ExternalLink, Users, WalletCards, MessageSquareText, CheckCircle2, Info, Download, CalendarDays } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const audienceConfig = {
  Parents: { app: 'Parent App', icon: Smartphone, channels: ['Parent App'], subtitle: 'Class updates, reminders and announcements for families.' },
  Teachers: { app: 'Teacher App', icon: GraduationCap, channels: ['Teacher App'], subtitle: 'Academic and operational updates for teachers.' },
  Director: { app: 'Director App', icon: ShieldCheck, channels: ['Director App'], subtitle: 'Management updates and approval-related messages.' },
};

const emptyNotification = {
  title: '', message: '', audience: 'Parents', class_name: '', section: '',
  channels: ['Parent App'], scheduled_for: '', approval_type: 'Staff & HR',
  priority: 'Standard', reason: '', institutional_impact: '', approval_required: '',
  requested_by: 'Admin Office', decision_due: '',
};

export const Notifications = ({ mode = 'dashboard' }) => {
  const { auth } = useAuth();
  const [center, setCenter] = useState(null);
  const [rules, setRules] = useState([]);
  const [structure, setStructure] = useState({ classes: [] });
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyNotification);
  const [approvalDocs, setApprovalDocs] = useState([]);
  const isAdmin = auth?.role === 'admin';
  const load = async () => {
    try {
      const [centerResponse, setupResponse, rulesResponse] = await Promise.all([api.get('/notifications/center'), api.get('/academic-structure'), api.get('/notifications/rules')]);
      setCenter(centerResponse.data); setStructure(setupResponse.data || { classes: [] });
      setRules(rulesResponse.data || []);
    } catch (err) { setNotice(err.response?.data?.detail || 'Could not load the Notification Center.'); }
  };
  useEffect(() => { load(); }, []);
  const selectedClass = useMemo(() => structure.classes?.find((item) => item.name === form.class_name), [structure, form.class_name]);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setNotice('');
    try {
      let data;
      if (form.audience === 'Director') {
        const payload = new FormData();
        Object.entries({
          title: form.title, summary: form.message, approval_type: form.approval_type,
          priority: form.priority, reason: form.reason, institutional_impact: form.institutional_impact,
          approval_required: form.approval_required, requested_by: form.requested_by,
          decision_due: form.decision_due, channels: JSON.stringify(form.channels),
        }).forEach(([key, value]) => payload.append(key, value));
        approvalDocs.forEach((file) => payload.append('supporting_documents', file));
        ({ data } = await api.post('/notifications/director-approval', payload));
        setNotice(`Approval ${data.id} was sent to the Director App.`);
      } else {
        ({ data } = await api.post('/notifications/broadcast', form));
        setNotice(`Notification sent to ${data.recipients_count} recipient(s) through the selected app.`);
      }
      setForm(emptyNotification);
      setApprovalDocs([]);
      await load();
    } catch (err) { setNotice(err.response?.data?.detail || 'Could not send the notification.'); }
    finally { setSaving(false); }
  };
  const setAudience = (audience) => setForm((current) => ({
    ...current, audience,
    class_name: audience === 'Parents' ? current.class_name : '',
    section: audience === 'Parents' ? current.section : '',
    channels: [audienceConfig[audience].app],
  }));
  const toggleRule = async (rule, enabled) => {
    setNotice('');
    try {
      await api.put(`/notifications/rules/${rule.key}`, { enabled, channels: rule.channels });
      setRules((current) => current.map((item) => item.key === rule.key ? { ...item, enabled } : item));
      setNotice(`${rule.event} notifications are now ${enabled ? 'active' : 'paused'}.`);
    } catch (err) { setNotice(err.response?.data?.detail || 'Could not update the automatic notification.'); }
  };
  const overview = center?.summary || {};
  return <Layout>
    <PageTitle title={mode === 'send' ? 'Send Notification' : 'Notification Dashboard'} subtitle={mode === 'send' ? 'Send one clear message to the Parent, Teacher or Director app.' : 'See notification activity, delivery history and Director approvals in one place.'} actions={<Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh</Btn>} />
    {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('queued') ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>{notice}</div>}
    {!center ? <div className="flex justify-center py-24 text-[#999]"><Loader2 className="h-7 w-7 animate-spin" /></div> : <>
      {mode === 'dashboard' && <NotificationDashboard overview={overview} history={center.history || []} approvals={center.approvals || []} rules={rules} isAdmin={isAdmin} onToggleRule={toggleRule} canViewOtp={auth?.role === 'director'} />}
      {mode === 'send' && <SendNotification form={form} setForm={setForm} approvalDocs={approvalDocs} setApprovalDocs={setApprovalDocs} selectedClass={selectedClass} structure={structure} isAdmin={isAdmin} setAudience={setAudience} saving={saving} onSubmit={submit} />}
    </>}
  </Layout>;
};

const ApprovalDetail = ({ item, onClose, canViewOtp }) => {
  if (!item) return null;
  const facts = [
    ['Reason', item.reason, Gavel],
    ['Institutional impact', item.institutional_impact, Building2],
    ['Why approval is required', item.approval_required, ShieldCheck],
    ['Requested by', item.requested_by, UserRound],
    ['Decision timeline', item.decision_due ? new Date(item.decision_due).toLocaleString() : 'Not provided', Clock3],
  ];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between border-b border-slate-100 px-7 py-6">
        <div><div className="flex flex-wrap gap-2"><Badge color="blue">{item.type}</Badge><Badge color={item.priority === 'Critical' ? 'red' : item.priority === 'High risk' ? 'amber' : 'gray'}>{item.priority || 'Standard'}</Badge></div><h3 className="mt-3 text-xl font-bold text-slate-950">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{item.summary || item.message}</p></div>
        <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-4 p-7">
        {canViewOtp && item.otp_code && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">KDM one-time approval code</p><p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-amber-950">{item.otp_code}</p><p className="mt-2 text-[11px] leading-5 text-amber-800">Verify the affected student list first. Share this code only with the Admin who created request {item.linked_request_id || item.id}. It expires at the decision deadline.</p></div></div></div>}
        {facts.map(([label, value, Icon]) => <div key={label} className="flex gap-4 rounded-2xl border border-slate-100 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[13px] font-medium leading-5 text-slate-800">{value || 'Not provided'}</p></div></div>)}
        <div className="rounded-2xl border border-slate-100 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Supporting documents</p><div className="mt-3 space-y-2">{item.supporting_documents?.length ? item.supporting_documents.map((doc) => <a key={doc.url || doc.name} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-[12px] font-semibold text-slate-700 hover:bg-indigo-50"><span className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-indigo-500" />{doc.name}</span><ExternalLink className="h-4 w-4" /></a>) : <p className="text-[12px] text-slate-400">No documents attached.</p>}</div></div>
      </div>
    </div>
  </div>;
};

const NotificationDashboard = ({ overview, history, approvals, rules, isAdmin, onToggleRule, canViewOtp }) => {
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [tab, setTab] = useState('register');
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('All audiences');
  const visibleHistory = history.filter((item) => {
    const text = `${item.title || ''} ${item.message || ''} ${item.class_name || ''} ${item.section || ''}`.toLowerCase();
    return (audience === 'All audiences' || item.audience === audience) && text.includes(search.trim().toLowerCase());
  });
  const activeRules = rules.filter((item) => item.enabled).length;
  return <>
    <div className="rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-7 text-white shadow-xl shadow-indigo-100 md:p-9">
      <div className="flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between"><div className="max-w-xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"><BellRing className="h-3.5 w-3.5" /> School communication centre</span><h2 className="mt-5 font-poppins text-3xl font-bold">Every important update, clearly delivered.</h2><p className="mt-3 text-[13px] leading-6 text-indigo-100/70">Send targeted notices, follow Director decisions and manage automatic reminders in one place.</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[610px]">
      {[
        { label: 'Messages sent', value: overview.total_sent || 0, icon: Send },
        { label: 'Parent notices', value: overview.parent_sends || 0, icon: Smartphone },
        { label: 'Teacher notices', value: overview.teacher_sends || 0, icon: GraduationCap },
        { label: 'Pending decisions', value: overview.pending_approvals || 0, icon: ShieldCheck },
      ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><Icon className="h-4 w-4 text-indigo-200" /><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-[10px] text-indigo-100/65">{label}</p></div>)}
      </div></div>
    </div>
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-2"><button onClick={() => setTab('register')} className={`rounded-xl px-4 py-2.5 text-[11px] font-semibold ${tab === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Message register</button><button onClick={() => setTab('rules')} className={`rounded-xl px-4 py-2.5 text-[11px] font-semibold ${tab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Automatic reminders · {activeRules}/{rules.length}</button></div>{tab === 'register' && <div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" className="h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11px] outline-none" /></label><select value={audience} onChange={(event) => setAudience(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600"><option>All audiences</option><option>Parents</option><option>Teachers</option></select></div>}</div>
    {tab === 'rules' ? <div className="mt-6"><AutomationRules rules={rules} isAdmin={isAdmin} onToggle={onToggleRule} /></div> : <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card title="Message register" subtitle={`${visibleHistory.length} message${visibleHistory.length === 1 ? '' : 's'} match this view.`} className="xl:col-span-3" pad="p-0">
        {visibleHistory.length ? <div className="divide-y divide-slate-100">{visibleHistory.slice(0, 20).map((item) => { const config = audienceConfig[item.audience] || audienceConfig.Director; const Icon = config.icon; return <div key={item.id} className="flex items-start gap-3 px-6 py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold text-slate-800">{item.title}</p><Badge color={item.audience === 'Parents' ? 'blue' : 'green'}>{config.app}</Badge></div><p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{item.message}</p><p className="mt-1.5 text-[10px] text-slate-400">{item.recipients_count || 0} recipients{item.class_name ? ` • ${item.class_name}${item.section ? ` / ${item.section}` : ''}` : ''} • {item.created ? new Date(item.created).toLocaleString() : 'Recently'}</p></div><Badge color={item.status === 'Scheduled' ? 'blue' : 'green'}>{item.status || 'Queued'}</Badge></div>; })}</div> : <div className="py-16 text-center"><Search className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-[13px] text-slate-500">No messages match this view.</p></div>}
      </Card>
      <Card title="Director decisions" subtitle="Open a request to review its complete decision brief." className="xl:col-span-2" pad="p-0">
        {approvals.length ? <div className="divide-y divide-slate-100">{approvals.slice(0, 10).map((item) => <button type="button" key={item.id} onClick={() => setSelectedApproval(item)} className="block w-full px-5 py-4 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FileCheck2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-400">Requested by {item.requested_by || 'Admin'} • {item.created ? new Date(item.created).toLocaleString() : 'Recently'}</p></div><Badge color={item.status === 'Pending' ? 'amber' : item.status === 'Approved' ? 'green' : 'gray'}>{item.status}</Badge></div></button>)}</div> : <div className="py-16 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-[13px] text-slate-400">No Director approval requests yet.</p></div>}
      </Card>
    </div>}
    <ApprovalDetail item={selectedApproval} canViewOtp={canViewOtp} onClose={() => setSelectedApproval(null)} />
  </>;
};

const TextArea = ({ label, value, onChange, placeholder, rows = 3 }) => <label className="block text-[12px] text-[#8a8a8a]">{label}<span className="ml-1 text-red-500">*</span><textarea required value={value} onChange={onChange} rows={rows} placeholder={placeholder} className="mt-1.5 w-full resize-y rounded-lg border border-[#ececee] bg-[#f6f6f7] px-3.5 py-3 text-[13px] outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100" /></label>;

const SendNotification = ({ form, setForm, approvalDocs, setApprovalDocs, selectedClass, structure, isAdmin, setAudience, saving, onSubmit }) => {
  const isDirector = form.audience === 'Director';
  const directorReady = !isDirector || (form.approval_type && form.priority && form.reason.trim() && form.institutional_impact.trim() && form.approval_required.trim() && form.requested_by.trim() && form.decision_due && approvalDocs.length);
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
    <Card title={isDirector ? 'Create Director approval' : 'Compose notification'} subtitle={isDirector ? 'Prepare a complete decision brief; every approval field is mandatory.' : 'First choose which app should receive this message.'} className="xl:col-span-3">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{Object.entries(audienceConfig).map(([audience, config]) => { const Icon = config.icon; return <button type="button" key={audience} onClick={() => setAudience(audience)} className={`rounded-2xl border p-4 text-left transition ${form.audience === audience ? 'border-indigo-200 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${form.audience === audience ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}><Icon className="h-4 w-4" /></span><p className="mt-3 text-[13px] font-semibold text-slate-800">{config.app}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{config.subtitle}</p></button>; })}</div>
        {!isDirector && <div className="max-w-md"><Field label="Schedule (optional)" type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></div>}
        {form.audience === 'Parents' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Class" select value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value, section: '' })} options={structure.classes?.map((item) => item.name) || []} /><Field label="Section" select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} options={selectedClass?.sections?.map((item) => item.name) || []} /></div>}
        <Field label={isDirector ? 'Approval request title *' : 'Notification title'} value={form.title} placeholder={isDirector ? 'e.g. Senior coordinator medical leave' : 'e.g. Parent–teacher meeting this Saturday'} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <TextArea label={isDirector ? 'Executive summary' : 'Message'} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={isDirector ? 3 : 6} placeholder={isDirector ? 'Summarise the current situation and proposed decision.' : 'Write a clear, respectful message...'} />
        {isDirector && <div className="space-y-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <div><p className="text-[14px] font-bold text-indigo-950">Mandatory approval details</p><p className="mt-1 text-[11px] text-indigo-700">These details will appear in the Director App exactly as a decision brief.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Approval type *" select value={form.approval_type} onChange={(e) => setForm({ ...form, approval_type: e.target.value })} options={['Staff & HR', 'Academic', 'Finance', 'Operations', 'Policy & Compliance', 'Other']} /><Field label="Priority *" select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={['Standard', 'High risk', 'Critical']} /></div>
          <TextArea label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why is this request being raised?" />
          <TextArea label="Institutional impact" value={form.institutional_impact} onChange={(e) => setForm({ ...form, institutional_impact: e.target.value })} placeholder="Explain the impact on students, staff, finance or school operations." />
          <TextArea label="Why Director approval is required" value={form.approval_required} onChange={(e) => setForm({ ...form, approval_required: e.target.value })} placeholder="Mention the policy, threshold or authority that requires this decision." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Requested by *" value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} placeholder="e.g. HR Office · Priya Shah" /><Field label="Decision timeline *" type="datetime-local" value={form.decision_due} onChange={(e) => setForm({ ...form, decision_due: e.target.value })} /></div>
          <label className="block rounded-2xl border border-dashed border-indigo-200 bg-white p-5 text-center hover:bg-indigo-50"><input type="file" multiple required={!approvalDocs.length} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => setApprovalDocs([...approvalDocs, ...Array.from(e.target.files || [])])} /><Paperclip className="mx-auto h-5 w-5 text-indigo-500" /><p className="mt-2 text-[12px] font-semibold text-slate-700">Attach supporting documents <span className="text-red-500">*</span></p><p className="mt-1 text-[10px] text-slate-400">PDF, image, Word or Excel · maximum 15 MB per file</p></label>
          {approvalDocs.length > 0 && <div className="space-y-2">{approvalDocs.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3"><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-slate-700">{file.name}</p><p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</p></div><button type="button" onClick={() => setApprovalDocs(approvalDocs.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-4 w-4" /></button></div>)}</div>}
        </div>}
        <Btn type="submit" icon={saving ? Loader2 : Send} disabled={!isAdmin || saving || !form.title.trim() || !form.message.trim() || !form.channels.length || !directorReady}>{saving ? 'Sending…' : isDirector ? 'Send for Director approval' : form.scheduled_for ? 'Schedule notification' : 'Send notification'}</Btn>
      </form>
    </Card>
    <Card title={isDirector ? 'Approval readiness' : 'Delivery summary'} subtitle={isDirector ? 'Confirm the decision pack before sending.' : 'Confirm the target before sending.'} className="xl:col-span-2"><div className="space-y-4 text-[12px] text-slate-600"><div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">Destination</p><p className="mt-2 text-[17px] font-bold text-indigo-950">{audienceConfig[form.audience].app}</p><p className="mt-1 text-[11px] text-indigo-700">{form.class_name ? `${form.class_name}${form.section ? ` / ${form.section}` : ''}` : isDirector ? 'Director approval inbox' : `All ${form.audience}`}</p></div>{isDirector ? <><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800"><p className="font-semibold">Director approval case</p><p className="mt-1 leading-5">Creates the complete approval record with documents, deadline and audit trail in the Director App.</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-800">Required pack</p><p className="mt-2 leading-6">Reason · Institutional impact · Approval authority · Requester · Evidence · Decision timeline</p></div></> : <div className="rounded-xl bg-blue-50 p-4 text-blue-800"><p className="font-semibold">Recorded automatically</p><p className="mt-1 leading-5">The message, recipient app, Admin name, time and delivery status will appear on the Notification Dashboard.</p></div>}{!isAdmin && <div className="rounded-xl bg-amber-50 p-4 text-amber-800">Only an Admin can send a notification.</div>}</div></Card>
  </div>;
};

const AutomationRules = ({ rules, isAdmin, onToggle }) => <Card title="Automatic notification rules" subtitle="Routine messages are triggered by their ERP event. Turn off a rule only if your school has an approved alternate process." pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'ERP event' }, { label: 'Recipient' }, { label: 'Automatic action' }, { label: 'Channels' }, { label: 'Status' }]}>{rules.map((rule) => <tr key={rule.key} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4"><p className="text-[13px] font-semibold text-slate-800">{rule.event}</p><p className="mt-0.5 max-w-sm text-[11px] text-slate-400">{rule.description}</p></td><td className="py-4 text-[12px] text-slate-600">{rule.audience}</td><td className="py-4 text-[12px] text-slate-600">Triggered automatically</td><td className="py-4"><div className="flex flex-wrap gap-1">{rule.channels.map((channel) => <Badge key={channel} color="blue">{channel}</Badge>)}</div></td><td className="py-4 pr-6"><button disabled={!isAdmin} onClick={() => onToggle(rule, !rule.enabled)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${rule.enabled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'} disabled:cursor-not-allowed`}><span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-slate-400'}`} />{rule.enabled ? 'Active' : 'Paused'}</button></td></tr>)}</Table></div></Card>;

const DeliveryHistory = ({ history }) => <Card title="Delivery history" subtitle="Every manual announcement is stored with its audience, chosen channel and queue status." pad="p-0">{history.length ? <div className="overflow-x-auto"><Table columns={[{ label: 'Message' }, { label: 'Audience' }, { label: 'Channels' }, { label: 'Recipients' }, { label: 'Created' }, { label: 'Status' }]}>{history.map((item) => <tr key={item.id} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4"><p className="text-[13px] font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 max-w-sm truncate text-[11px] text-slate-400">{item.message}</p></td><td className="py-4 text-[12px] text-slate-600">{item.audience}{item.class_name ? ` • ${item.class_name}${item.section ? ` / ${item.section}` : ''}` : ''}</td><td className="py-4"><div className="flex flex-wrap gap-1">{(item.channels || []).map((channel) => <Badge key={channel} color="blue">{channel}</Badge>)}</div></td><td className="py-4 text-[12px] font-semibold text-slate-700">{item.recipients_count || 0}</td><td className="py-4 text-[11px] text-slate-500">{item.created ? new Date(item.created).toLocaleString() : '—'}</td><td className="py-4 pr-6"><Badge color={item.status === 'Needs review' ? 'amber' : item.status === 'Scheduled' ? 'blue' : 'green'}>{item.status || 'Queued for review'}</Badge></td></tr>)}</Table></div> : <div className="py-20 text-center"><History className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-[13px] text-slate-400">No manual announcements have been queued yet.</p></div>}</Card>;

export const Communications = () => {
  const [tab, setTab] = useState('overview');
  const [audience, setAudience] = useState('Parents');
  const [schoolClass, setSchoolClass] = useState('All classes');
  const [section, setSection] = useState('All sections');
  const [teacherScope, setTeacherScope] = useState('All teachers');
  const [selectedTeacher, setSelectedTeacher] = useState('Ananya Rao · English');
  const [reportMode, setReportMode] = useState('month');
  const [reportMonth, setReportMonth] = useState('2026-08');
  const [reportDate, setReportDate] = useState('2026-08-24');
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const smsUnits = Math.max(1, Math.ceil(words / 180));
  const recipients = audience === 'Parents' ? (schoolClass === 'All classes' ? 682 : 118) : teacherScope === 'Individual teacher' ? 1 : (schoolClass === 'All classes' ? 46 : 12);
  const credits = recipients * smsUnits;
  const balance = 12480;
  const records = [
    { message: "Tomorrow's school assembly begins at 8:15 AM. Please ensure students arrive on time.", audience: 'Parents', group: 'All classes', sent: '24 Aug 2026, 10:42 AM', date: '2026-08-24', recipients: 682, credits: 682 },
    { message: 'Staff meeting in the conference room at 3:30 PM today.', audience: 'Teachers', group: 'All sections', sent: '24 Aug 2026, 9:05 AM', date: '2026-08-24', recipients: 46, credits: 46 },
    { message: 'Reminder: Grade 8 parent-teacher meeting is scheduled for Saturday, 24 August.', audience: 'Parents', group: 'Grade 8 · A, B, C', sent: '22 Aug 2026, 4:15 PM', date: '2026-08-22', recipients: 118, credits: 118 },
    { message: 'The Grade 5 field trip has been rescheduled to Friday. Updated details will follow.', audience: 'Parents', group: 'Grade 5 · A & B', sent: '21 Aug 2026, 1:20 PM', date: '2026-08-21', recipients: 73, credits: 73 },
    { message: 'July attendance summaries are now available in the parent app.', audience: 'Parents', group: 'All classes', sent: '31 Jul 2026, 11:30 AM', date: '2026-07-31', recipients: 682, credits: 682 },
  ];
  const filteredRecords = records.filter((row) => reportMode === 'month' ? row.date.startsWith(reportMonth) : row.date === reportDate);
  const downloadReport = () => {
    const header = ['Date', 'Message', 'Audience', 'Class / Section', 'Recipients', 'Status', 'Credits'];
    const lines = filteredRecords.map((row) => [row.sent, row.message, row.audience, row.group, row.recipients, 'Delivered', row.credits]);
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `orison-sms-report-${reportMode === 'month' ? reportMonth : reportDate}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const sendSms = () => { if (!text.trim()) return; setSent(true); setText(''); setTimeout(() => setSent(false), 3500); };
  return (
    <Layout>
      <PageTitle title="Communications" subtitle="Send clear, targeted SMS updates to parents and teachers." />
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-50 p-1">{[['overview','Overview'],['history','Message history']].map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2.5 text-[11px] font-semibold transition ${tab === key ? 'bg-white text-[#C4141B] shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>{label}{key === 'history' && <span className={`ml-2 rounded-full px-2 py-0.5 text-[9px] ${tab === key ? 'bg-red-50 text-[#C4141B]' : 'bg-white text-slate-400'}`}>{records.length}</span>}</button>)}</div>
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 px-4 py-2.5 ring-1 ring-red-100"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#C4141B] shadow-sm"><WalletCards className="h-4 w-4" /></span><div><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-red-400">SMS credit balance</p><p className="text-[16px] font-bold text-[#8F1016]">{balance.toLocaleString()} <span className="text-[9px] font-medium text-red-400">remaining</span></p></div></div>
      </div>
      {tab === 'overview' && <>
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">{[[MessageSquareText,'Messages sent this month','18,426','↑ 12% from last month'],[CheckCircle2,'Delivery rate','98.6%','256 messages undelivered'],[WalletCards,'Credits used this month','19,108','12,480 credits available']].map(([Icon,label,value,note],i) => <div key={label} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className={`absolute right-0 top-0 h-20 w-20 translate-x-7 -translate-y-7 rounded-full opacity-60 ${i===0?'bg-red-50':i===1?'bg-emerald-50':'bg-violet-50'}`} /><div className="relative flex items-center gap-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${i===0?'bg-red-50 text-[#C4141B]':i===1?'bg-emerald-50 text-emerald-600':'bg-violet-50 text-violet-600'}`}><Icon className="h-5 w-5" /></span><div><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[23px] font-bold text-slate-950">{value}</p><p className="mt-1 text-[9px] text-slate-400">{note}</p></div></div></div>)}</div>
        <Card pad="p-0" className="overflow-hidden rounded-3xl border-slate-100 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/70 px-6 py-5"><div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#C4141B]"><Send className="h-4 w-4" /></span><h2 className="text-[16px] font-bold">Compose new SMS</h2></div><p className="mt-2 text-[11px] text-slate-400">Choose recipients, write your message and review credit usage.</p></div><Badge color="green">Direct SMS</Badge></div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px]">
            <div className="p-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Send to</p>
              <div className="mb-5 grid gap-3 sm:grid-cols-2">{[['Parents',Users,'Families and guardians'],['Teachers',GraduationCap,'Faculty members']].map(([name,Icon,note]) => <button key={name} onClick={() => setAudience(name)} className={`flex items-center gap-3 rounded-xl border p-4 text-left ${audience === name ? 'border-[#C4141B] bg-red-50/50 ring-1 ring-[#C4141B]' : 'border-slate-200'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${audience===name?'bg-[#C4141B] text-white':'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></span><span><b className="block text-[12px]">{name}</b><small className="text-[10px] text-slate-400">{note}</small></span></button>)}</div>
              <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Class<select value={schoolClass} onChange={(e)=>setSchoolClass(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] normal-case tracking-normal"><option value="All classes" label="All classes" />{[5,6,7,8,9,10].map(n=>{const label=`Grade ${n}`;return <option key={n} value={label} label={label}/>;})}</select></label><label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Section<select value={section} onChange={(e)=>setSection(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] normal-case tracking-normal"><option value="All sections" label="All sections" />{['A','B','C'].map(s=>{const label=`Section ${s}`;return <option key={s} value={label} label={label}/>;})}</select></label></div>
              {audience === 'Teachers' && <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-violet-700">Teacher recipients</p>
                <div className="grid gap-3 sm:grid-cols-2">{['All teachers','Individual teacher'].map(scope => <button type="button" key={scope} onClick={() => setTeacherScope(scope)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${teacherScope === scope ? 'border-violet-500 bg-white ring-1 ring-violet-400' : 'border-violet-100 bg-white/70'}`}><span className={`h-4 w-4 rounded-full border-2 p-[3px] ${teacherScope === scope ? 'border-violet-600 bg-violet-600 bg-clip-content' : 'border-slate-300'}`} /><span><b className="block text-[11px] text-slate-800">{scope}</b><small className="text-[9px] text-slate-400">{scope === 'All teachers' ? 'Send to every matching teacher' : 'Select one faculty member'}</small></span></button>)}</div>
                {teacherScope === 'Individual teacher' && <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Select teacher<select value={selectedTeacher} onChange={(e)=>setSelectedTeacher(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-[12px] font-medium normal-case tracking-normal outline-none focus:border-violet-400"><option>Ananya Rao · English</option><option>Vikram Nair · Mathematics</option><option>Meera Shah · Science</option><option>Rohan Iyer · Social Studies</option><option>Priya Menon · Hindi</option><option>Arjun Kapoor · Physical Education</option></select></label>}
              </div>}
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Message <span className="font-normal normal-case tracking-normal text-slate-300">Required</span></p>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 focus-within:border-red-300"><textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="Type your SMS message here…" className="h-32 w-full resize-none p-4 text-[12px] outline-none" /><div className="flex justify-between border-t border-slate-100 px-4 py-2 text-[9px] text-slate-400"><span>{words} / 180 words</span><span>{smsUnits} SMS credit{smsUnits>1?'s':''} per recipient</span></div></div>
              <div className={`mt-3 flex gap-3 rounded-xl p-3 ${words>180?'bg-amber-50 text-amber-700':'bg-blue-50 text-blue-700'}`}><Info className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-[10px] leading-relaxed"><b className="block">SMS credit usage</b>Messages above 180 words are treated as 2 SMS credits per recipient. Every additional 180 words uses another credit.</p></div>
            </div>
            <aside className="border-t border-slate-100 bg-slate-50/70 p-6 xl:border-l xl:border-t-0"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Message summary</p><div className="mt-4 rounded-xl border border-slate-100 bg-white p-4"><p className="text-[9px] text-slate-400">Sending to</p><p className="mt-1 text-[14px] font-bold">{audience === 'Teachers' && teacherScope === 'Individual teacher' ? selectedTeacher.split(' · ')[0] : audience}</p><p className="mt-1 text-[9px] text-slate-400">{audience === 'Teachers' ? `${teacherScope}${teacherScope === 'Individual teacher' ? ` · ${selectedTeacher.split(' · ')[1]}` : ''} · ` : ''}{schoolClass} · {section}</p></div><div className="mt-4 space-y-3 text-[10px] text-slate-500"><div className="flex justify-between"><span>Recipients</span><b className="text-slate-800">~{recipients}</b></div><div className="flex justify-between"><span>Credits per recipient</span><b className="text-slate-800">{smsUnits}</b></div><div className="border-t border-slate-200 pt-4"><div className="flex items-end justify-between"><span>Estimated credits</span><b className="text-[22px] text-[#C4141B]">{credits.toLocaleString()}</b></div></div><div className="flex justify-between rounded-lg bg-red-50 p-3 text-red-700"><span>Balance after sending</span><b>{(balance-credits).toLocaleString()}</b></div></div><button onClick={sendSms} disabled={!text.trim()} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C4141B] text-[11px] font-semibold text-white disabled:bg-slate-300"><Send className="h-4 w-4" />Send message</button><p className="mt-2 text-center text-[8px] text-slate-400">Confirmation is required before final delivery.</p></aside>
          </div>
        </Card>
      </>}
      {tab === 'history' && <Card pad="p-0" className="overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="flex items-center gap-2"><History className="h-4 w-4 text-[#C4141B]" /><h2 className="text-[15px] font-bold">Message history</h2></div><p className="mt-1 text-[10px] text-slate-400">Filter direct SMS records by calendar date or month and download the report.</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <div><p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Report period</p><div className="flex rounded-lg bg-slate-100 p-1">{[['month','Month'],['date','Date']].map(([key,label]) => <button key={key} onClick={() => setReportMode(key)} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${reportMode === key ? 'bg-white text-[#C4141B] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div></div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400"><span className="mb-1.5 block">{reportMode === 'month' ? 'Select month' : 'Select date'}</span><span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type={reportMode === 'month' ? 'month' : 'date'} value={reportMode === 'month' ? reportMonth : reportDate} onChange={(e) => reportMode === 'month' ? setReportMonth(e.target.value) : setReportDate(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-red-300" /></span></label>
              <button onClick={downloadReport} disabled={!filteredRecords.length} className="flex h-10 items-center gap-2 rounded-lg bg-[#C4141B] px-4 text-[10px] font-semibold text-white shadow-md shadow-red-100 hover:bg-[#A91116] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"><Download className="h-4 w-4" />Download report</button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><p className="text-[10px] text-slate-500"><b className="text-slate-800">{filteredRecords.length}</b> SMS record{filteredRecords.length === 1 ? '' : 's'} found</p><p className="text-[10px] text-slate-500">Total credits used: <b className="text-[#C4141B]">{filteredRecords.reduce((total, row) => total + row.credits, 0).toLocaleString()}</b></p></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-slate-50 text-left text-[8px] uppercase tracking-wider text-slate-400"><th className="px-6 py-3">Message</th><th className="px-4 py-3">Audience</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Recipients</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Credits</th></tr></thead><tbody>{filteredRecords.map(row=><tr key={row.message} className="border-b border-slate-50"><td className="max-w-md px-6 py-4"><p className="text-[11px] font-medium text-slate-700">{row.message}</p><p className="mt-1 text-[9px] text-slate-400">{row.group}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${row.audience==='Parents'?'bg-red-50 text-[#C4141B]':'bg-violet-50 text-violet-600'}`}>{row.audience}</span></td><td className="whitespace-nowrap px-4 py-4 text-[9px] text-slate-500">{row.sent}</td><td className="px-4 py-4 text-[10px] font-semibold">{row.recipients}</td><td className="px-4 py-4 text-[9px] font-semibold text-emerald-600">● Delivered</td><td className="px-4 py-4 text-[10px] font-semibold">{row.credits}</td></tr>)}{!filteredRecords.length && <tr><td colSpan="6" className="px-6 py-16 text-center"><CalendarDays className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-[11px] font-medium text-slate-500">No SMS records found for this {reportMode}.</p><p className="mt-1 text-[9px] text-slate-400">Choose a different reporting period.</p></td></tr>}</tbody></table></div>
      </Card>}
      {sent && <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white shadow-2xl"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><div><p className="text-[11px] font-semibold">SMS added to delivery queue</p><p className="text-[9px] text-white/50">Credit estimate has been reserved.</p></div></div>}
    </Layout>
  );
};
