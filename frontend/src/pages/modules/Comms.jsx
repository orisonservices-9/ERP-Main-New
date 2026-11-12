import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, Card, Btn, Badge, Field, Table } from '../../components/Shared';
import { CONVERSATIONS } from '../../mock2';
import { Send, Search, Loader2, BellRing, RefreshCw, Smartphone, GraduationCap, ShieldCheck, FileCheck2, History, Paperclip, X, Clock3, Building2, Gavel, UserRound, ExternalLink, Users, WalletCards, MessageSquareText, CheckCircle2, Info, Download, CalendarDays } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const audienceConfig = {
  Parents: { app: 'Parent App', icon: Smartphone, channels: ['Parent App', 'WhatsApp'], subtitle: 'Class updates, reminders and announcements for families.' },
  Teachers: { app: 'Teacher App', icon: GraduationCap, channels: ['Teacher App', 'WhatsApp'], subtitle: 'Academic and operational updates for teachers.' },
  Director: { app: 'Director App', icon: ShieldCheck, channels: ['Director App'], subtitle: 'Management updates and approval-related messages.' },
};

const emptyNotification = {
  title: '', message: '', audience: 'Parents', class_name: '', section: '',
  recipient_id: '', channels: ['Parent App'], scheduled_for: '', approval_type: 'Staff & HR',
  priority: 'Standard', reason: '', institutional_impact: '', approval_required: '',
  requested_by: 'Admin Office', decision_due: '',
};

const MESSAGE_TEMPLATES = [
  { label: 'Choose a template', title: '', message: '' },
  { label: 'Parent–teacher meeting', title: 'Parent–teacher meeting', message: 'Dear Parent, a parent–teacher meeting has been scheduled. Please check the Parent App for the date and time.' },
  { label: 'School holiday', title: 'School holiday notice', message: 'Dear Parent, the school will remain closed on the announced date. Classes will resume as per the regular timetable.' },
  { label: 'Fee reminder', title: 'Fee payment reminder', message: 'Dear Parent, this is a courteous reminder to review the pending school fee in the Parent App. Please ignore this message if already paid.' },
  { label: 'Emergency update', title: 'Important school update', message: 'Dear Parent, please read this important school update and acknowledge it in the Parent App.' },
];

const ACADEMIC_MESSAGE_TEMPLATES = [
  { label: 'Choose a template', title: '', message: '' },
  { label: 'Parent–teacher meeting', title: 'Parent–teacher meeting', message: 'Dear Parent, a parent–teacher meeting has been scheduled. Please check the Parent App for the date and time.' },
  { label: 'Exam schedule', title: 'Exam schedule update', message: 'Dear Parent, the examination schedule has been updated. Please review the dates and subjects in the Parent App.' },
  { label: 'Homework reminder', title: 'Homework reminder', message: 'Dear Parent, please review the pending homework and teacher instructions in the Parent App.' },
  { label: 'Academic support meeting', title: 'Academic support meeting', message: 'Dear Parent, the school would like to discuss an academic support plan for your child. Please check the Parent App for details.' },
];

const notificationBelongsToRole = (item, role) => {
  if (!['academic_coordinator', 'fee_manager'].includes(role)) return true;
  const text = `${item?.title || ''} ${item?.message || ''} ${item?.event || ''} ${item?.description || ''} ${item?.key || ''}`.toLowerCase();
  if (role === 'fee_manager') return /fee|payment|receipt|collection|invoice|outstanding|unpaid/.test(text);
  return /academic|exam|mark|result|homework|syllabus|curriculum|class|subject|teacher|learning|support plan/.test(text);
};

export const Notifications = ({ mode = 'dashboard' }) => {
  const { auth } = useAuth();
  const [center, setCenter] = useState(null);
  const [rules, setRules] = useState([]);
  const [structure, setStructure] = useState({ classes: [] });
  const [recipients, setRecipients] = useState({ Parents: [], Teachers: [] });
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyNotification);
  const [approvalDocs, setApprovalDocs] = useState([]);
  const isAdmin = auth?.role === 'admin';
  const load = async () => {
    try {
      const [centerResponse, rulesResponse] = await Promise.all([api.get('/notifications/center'), api.get('/notifications/rules')]);
      const [setupResponse, studentResponse, teacherResponse] = await Promise.all([
        api.get('/academic-structure').catch(() => ({ data: { classes: [] } })),
        api.get('/students').catch(() => ({ data: [] })),
        api.get('/teachers').catch(() => ({ data: [] })),
      ]);
      setCenter(centerResponse.data); setStructure(setupResponse.data || { classes: [] });
      setRules(rulesResponse.data || []);
      setRecipients({ Parents: studentResponse.data || [], Teachers: teacherResponse.data || [] });
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
    class_name: audience === 'Parents' ? current.class_name : '', recipient_id: '',
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
  const actOnMessage = async (id, action) => {
    setNotice('');
    try {
      await api.post(`/notifications/${id}/${action}`);
      setNotice(action === 'cancel' ? 'The notification was cancelled and recorded in the audit history.' : 'A new copy was added to the delivery queue.');
      await load();
    } catch (err) { setNotice(err.response?.data?.detail || `Could not ${action} this notification.`); }
  };
  const overview = center?.summary || {};
  const isCommunications = mode === 'communications';
  const isCommunicationSend = mode === 'send-communication';
  const isSend = mode === 'send' || isCommunicationSend;
  const scopedHistory = (center?.history || []).filter((item) => notificationBelongsToRole(item, auth?.role));
  const scopedRules = rules.filter((item) => notificationBelongsToRole(item, auth?.role));
  const roleWorkspace = auth?.role === 'academic_coordinator' ? 'Academic' : auth?.role === 'fee_manager' ? 'Fee' : '';
  const scopedOverview = roleWorkspace ? {
    total_sent: scopedHistory.length,
    parent_sends: scopedHistory.filter((item) => item.audience === 'Parents').length,
    teacher_sends: scopedHistory.filter((item) => item.audience === 'Teachers').length,
    pending_approvals: 0,
  } : overview;
  const pageTitle = isSend
    ? `${roleWorkspace ? `${roleWorkspace} ` : ''}${isCommunicationSend ? 'Communication' : 'Notification'}`
    : roleWorkspace ? `${roleWorkspace} Notification Centre` : isCommunications ? 'Communications Centre' : 'Notification Dashboard';
  const pageSubtitle = roleWorkspace
    ? `View and send only ${roleWorkspace.toLowerCase()}-related messages for your authorised school workflow.`
    : isSend ? 'Send one clear message through the Orison App, WhatsApp or both.' : isCommunications ? 'Manage manually sent parent and teacher messages, schedules and reports.' : 'Monitor automatic ERP alerts, reminder rules and Director decisions.';
  return <Layout>
    <PageTitle title={pageTitle} subtitle={pageSubtitle} actions={isCommunications ? <div className="flex gap-2"><Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh</Btn><Btn icon={Send} onClick={() => { window.location.href = '/communications/send'; }}>Send message</Btn></div> : <Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh</Btn>} />
    {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[14px] ${notice.includes('queued') ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>{notice}</div>}
    {!center ? <div className="flex justify-center py-24 text-[#999]"><Loader2 className="h-7 w-7 animate-spin" /></div> : <>
      {(mode === 'dashboard' || isCommunications) && <NotificationDashboard role={auth?.role} view={isCommunications ? 'communications' : 'notifications'} overview={scopedOverview} history={scopedHistory} approvals={center.approvals || []} rules={scopedRules} structure={structure} isAdmin={isAdmin} onToggleRule={toggleRule} onMessageAction={actOnMessage} canViewOtp={auth?.role === 'director'} />}
      {isSend && <SendNotification form={form} setForm={setForm} approvalDocs={approvalDocs} setApprovalDocs={setApprovalDocs} selectedClass={selectedClass} structure={structure} recipients={recipients} isAdmin={['admin', 'academic_coordinator', 'fee_manager'].includes(auth?.role)} senderRole={auth?.role} setAudience={setAudience} saving={saving} onSubmit={submit} communicationOnly={isCommunicationSend} />}
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
        {canViewOtp && item.otp_code && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[12px] font-semibold uppercase tracking-wider text-amber-700">KDM one-time approval code</p><p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-amber-950">{item.otp_code}</p><p className="mt-2 text-[13px] leading-5 text-amber-800">Verify the affected student list first. Share this code only with the Admin who created request {item.linked_request_id || item.id}. It expires at the decision deadline.</p></div></div></div>}
        {facts.map(([label, value, Icon]) => <div key={label} className="flex gap-4 rounded-2xl border border-slate-100 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-4 w-4" /></span><div><p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[14px] font-medium leading-5 text-slate-800">{value || 'Not provided'}</p></div></div>)}
        <div className="rounded-2xl border border-slate-100 p-4"><p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Supporting documents</p><div className="mt-3 space-y-2">{item.supporting_documents?.length ? item.supporting_documents.map((doc) => <a key={doc.url || doc.name} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-indigo-50"><span className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-indigo-500" />{doc.name}</span><ExternalLink className="h-4 w-4" /></a>) : <p className="text-[13px] text-slate-400">No documents attached.</p>}</div></div>
      </div>
    </div>
  </div>;
};

const NotificationDashboard = ({ role, view = 'notifications', overview, history, approvals, rules, structure, isAdmin, onToggleRule, onMessageAction, canViewOtp }) => {
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [tab, setTab] = useState('register');
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('All audiences');
  const [classFilter, setClassFilter] = useState('All classes');
  const [sectionFilter, setSectionFilter] = useState('All sections');
  const [page, setPage] = useState(1);
  const isCommunications = view === 'communications';
  const roleScoped = ['academic_coordinator', 'fee_manager'].includes(role);
  const relevantHistory = history.filter((item) => roleScoped || (isCommunications ? !item.automatic && item.audience !== 'Director' : item.automatic || item.audience === 'Director'));
  const visibleHistory = relevantHistory.filter((item) => {
    const text = `${item.title || ''} ${item.message || ''} ${item.class_name || ''} ${item.section || ''}`.toLowerCase();
    return (audience === 'All audiences' || item.audience === audience)
      && (classFilter === 'All classes' || item.class_name === classFilter)
      && (sectionFilter === 'All sections' || item.section === sectionFilter)
      && text.includes(search.trim().toLowerCase());
  });
  const selectedFilterClass = structure?.classes?.find((item) => item.name === classFilter);
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(visibleHistory.length / pageSize));
  const pageHistory = visibleHistory.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, audience, classFilter, sectionFilter]);
  const activeRules = rules.filter((item) => item.enabled).length;
  const workspaceCopy = role === 'fee_manager'
    ? { badge: 'Fee reminder control', heading: 'Keep every fee follow-up clear.', body: 'Only fee dues, payments, receipts and collection reminders appear in this workspace.' }
    : role === 'academic_coordinator'
      ? { badge: 'Academic notification control', heading: 'Keep every academic update connected.', body: 'Only learning, examinations, homework, syllabus and student-support messages appear here.' }
      : { badge: 'Automatic notification control', heading: 'Never miss an important school signal.', body: 'System-generated alerts, automatic reminders and management decisions.' };
  const summaryCards = roleScoped ? [
    { label: 'Messages in scope', value: overview.total_sent || 0, icon: Send },
    { label: 'Parent notices', value: overview.parent_sends || 0, icon: Smartphone },
    { label: 'Teacher notices', value: overview.teacher_sends || 0, icon: GraduationCap },
    { label: 'Active reminders', value: activeRules, icon: BellRing },
  ] : [
    { label: 'Messages sent', value: overview.total_sent || 0, icon: Send },
    { label: 'Parent notices', value: overview.parent_sends || 0, icon: Smartphone },
    { label: 'Teacher notices', value: overview.teacher_sends || 0, icon: GraduationCap },
    { label: 'Pending decisions', value: overview.pending_approvals || 0, icon: ShieldCheck },
  ];
  const downloadRegister = () => {
    const rows = [['Created', 'Title', 'Message', 'Audience', 'Class', 'Section', 'Recipients', 'Source', 'Status'], ...visibleHistory.map((item) => [item.created || '', item.title || '', item.message || '', item.audience || '', item.class_name || '', item.section || '', item.recipients_count || 0, item.source || (item.automatic ? 'ERP automation' : 'Manual communication'), item.status || 'Queued'])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `orison-communication-register-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <>
    <div className={`rounded-[28px] bg-gradient-to-br ${isCommunications ? 'from-slate-950 via-blue-950 to-cyan-800' : 'from-slate-950 via-indigo-950 to-violet-800'} p-7 text-white shadow-xl shadow-indigo-100 md:p-9`}>
      <div className="flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between"><div className="max-w-xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.18em]">{isCommunications ? <MessageSquareText className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />} {isCommunications ? 'Manual communication workspace' : workspaceCopy.badge}</span><h2 className="mt-5 font-poppins text-3xl font-bold">{isCommunications ? 'Reach the right families and staff.' : workspaceCopy.heading}</h2><p className="mt-3 text-[14px] leading-6 text-indigo-100/70">{isCommunications ? 'Messages deliberately sent by Admin through the Orison App or WhatsApp.' : workspaceCopy.body}</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[610px]">
      {summaryCards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><Icon className="h-4 w-4 text-indigo-200" /><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-[12px] text-indigo-100/65">{label}</p></div>)}
      </div></div>
    </div>
    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-2"><button onClick={() => setTab('register')} className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold ${tab === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Message register</button><button onClick={() => setTab('rules')} className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold ${tab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Automatic reminders · {activeRules}/{rules.length}</button></div>{tab === 'register' && <button onClick={downloadRegister} disabled={!visibleHistory.length} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white disabled:bg-slate-300"><Download className="h-4 w-4" />Download report</button>}</div>{tab === 'register' && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or message" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] outline-none" /></label><select value={audience} onChange={(event) => setAudience(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600"><option>All audiences</option><option>Parents</option>{role !== 'fee_manager' && <option>Teachers</option>}{!roleScoped && <option>Director</option>}</select><select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setSectionFilter('All sections'); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600"><option>All classes</option>{(structure?.classes || []).map((item) => <option key={item.name}>{item.name}</option>)}</select><select value={sectionFilter} disabled={classFilter === 'All classes'} onChange={(event) => setSectionFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 disabled:bg-slate-100 disabled:text-slate-400"><option>All sections</option>{(selectedFilterClass?.sections || []).map((item) => <option key={item.name}>{item.name}</option>)}</select></div>}</div>
    {tab === 'rules' ? <div className="mt-6"><AutomationRules rules={rules} isAdmin={isAdmin} onToggle={onToggleRule} /></div> : <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card title={isCommunications ? 'Communication register' : roleScoped ? `${role === 'fee_manager' ? 'Fee' : 'Academic'} message register` : 'Automatic alert register'} subtitle={`${visibleHistory.length} message${visibleHistory.length === 1 ? '' : 's'} match this view.`} className={isCommunications || roleScoped ? 'xl:col-span-5' : 'xl:col-span-3'} pad="p-0">
        {visibleHistory.length ? <><div className="divide-y divide-slate-100">{pageHistory.map((item) => { const config = audienceConfig[item.audience] || audienceConfig.Director; const Icon = config.icon; return <div key={item.id} className="flex items-start gap-3 px-5 py-3.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[13px] font-semibold text-slate-800">{item.title}</p><Badge color={item.audience === 'Parents' ? 'blue' : 'green'}>{config.app}</Badge>{item.automatic && <Badge color="gray">Automatic</Badge>}</div><p className="mt-1 line-clamp-1 text-[12px] text-slate-500">{item.message}</p><p className="mt-1 text-[12px] text-slate-400">{item.recipients_count || 0} recipient(s){item.class_name ? ` • ${item.class_name}${item.section ? ` / ${item.section}` : ''}` : ''} • {item.created ? new Date(item.created).toLocaleString() : 'Recently'}</p>{isAdmin && !item.automatic && <div className="mt-1.5 flex gap-3"><button onClick={() => onMessageAction(item.id, 'resend')} className="text-[12px] font-semibold text-indigo-600">Resend</button>{!['Delivered','Cancelled'].includes(item.status) && <button onClick={() => onMessageAction(item.id, 'cancel')} className="text-[12px] font-semibold text-red-600">Cancel</button>}</div>}</div><Badge color={item.status === 'Cancelled' ? 'red' : item.status === 'Scheduled' ? 'blue' : 'green'}>{item.status || 'Queued'}</Badge></div>; })}</div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-4"><p className="text-[12px] text-slate-400">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleHistory.length)} of {visibleHistory.length}</p><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 disabled:opacity-30">Previous</button><span className="text-[12px] font-semibold text-slate-500">{page} / {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 disabled:opacity-30">Next</button></div></div></> : <div className="py-16 text-center"><Search className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-[14px] text-slate-500">No messages match this view.</p></div>}
      </Card>
      {!isCommunications && !roleScoped && <Card title="Director decisions" subtitle="Open a request to review its complete decision brief." className="xl:col-span-2" pad="p-0">
        {approvals.length ? <div className="divide-y divide-slate-100">{approvals.slice(0, 10).map((item) => <button type="button" key={item.id} onClick={() => setSelectedApproval(item)} className="block w-full px-5 py-4 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FileCheck2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[12px] text-slate-400">Requested by {item.requested_by || 'Admin'} • {item.created ? new Date(item.created).toLocaleString() : 'Recently'}</p></div><Badge color={item.status === 'Pending' ? 'amber' : item.status === 'Approved' ? 'green' : 'gray'}>{item.status}</Badge></div></button>)}</div> : <div className="py-16 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-[14px] text-slate-400">No Director approval requests yet.</p></div>}
      </Card>}
    </div>}
    <ApprovalDetail item={selectedApproval} canViewOtp={canViewOtp} onClose={() => setSelectedApproval(null)} />
  </>;
};

const TextArea = ({ label, value, onChange, placeholder, rows = 3 }) => <label className="block text-[13px] text-[#8a8a8a]">{label}<span className="ml-1 text-red-500">*</span><textarea required value={value} onChange={onChange} rows={rows} placeholder={placeholder} className="mt-1.5 w-full resize-y rounded-lg border border-[#ececee] bg-[#f6f6f7] px-3.5 py-3 text-[14px] outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100" /></label>;

const SendNotification = ({ form, setForm, approvalDocs, setApprovalDocs, selectedClass, structure, recipients, isAdmin, senderRole, setAudience, saving, onSubmit, communicationOnly = false }) => {
  const isDirector = form.audience === 'Director';
  const allowedAudiences = senderRole === 'fee_manager' ? ['Parents'] : senderRole === 'academic_coordinator' ? ['Parents', 'Teachers'] : Object.keys(audienceConfig);
  const availableTemplates = senderRole === 'fee_manager'
    ? MESSAGE_TEMPLATES.filter((item, index) => index === 0 || item.label === 'Fee reminder')
    : senderRole === 'academic_coordinator' ? ACADEMIC_MESSAGE_TEMPLATES : MESSAGE_TEMPLATES;
  const directorReady = !isDirector || (form.approval_type && form.priority && form.reason.trim() && form.institutional_impact.trim() && form.approval_required.trim() && form.requested_by.trim() && form.decision_due && approvalDocs.length);
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
    <Card title={isDirector ? 'Create Director approval' : 'Compose notification'} subtitle={isDirector ? 'Prepare a complete decision brief; every approval field is mandatory.' : 'First choose which app should receive this message.'} className="xl:col-span-3">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className={`grid grid-cols-1 gap-3 ${communicationOnly ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>{Object.entries(audienceConfig).filter(([audience]) => allowedAudiences.includes(audience) && (!communicationOnly || audience !== 'Director')).map(([audience, config]) => { const Icon = config.icon; return <button type="button" key={audience} onClick={() => setAudience(audience)} className={`rounded-2xl border p-4 text-left transition ${form.audience === audience ? 'border-indigo-200 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${form.audience === audience ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}><Icon className="h-4 w-4" /></span><p className="mt-3 text-[14px] font-semibold text-slate-800">{config.app}</p><p className="mt-1 text-[12px] leading-4 text-slate-500">{config.subtitle}</p></button>; })}</div>
        {!isDirector && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Send through</p><p className="mt-1 text-[12px] text-slate-400">Choose one or both delivery options.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{audienceConfig[form.audience].channels.map((channel) => { const selected = form.channels.includes(channel); return <button type="button" key={channel} onClick={() => setForm({ ...form, channels: selected ? form.channels.filter((item) => item !== channel) : [...form.channels, channel] })} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-indigo-300 bg-white ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-400'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected ? channel === 'WhatsApp' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700' : 'bg-slate-100'}`}>{channel === 'WhatsApp' ? <MessageSquareText className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}</span><span><b className="block text-[13px] text-slate-800">{channel}</b><small className="text-[12px]">{channel === 'WhatsApp' ? 'Send to the registered WhatsApp number' : `Show inside the ${audienceConfig[form.audience].app}`}</small></span><span className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border text-[13px] ${selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>{selected ? '✓' : ''}</span></button>; })}</div></div>}
        {!isDirector && <div className="grid max-w-3xl gap-4 md:grid-cols-2"><div><label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Message template</label><select defaultValue="0" onChange={(e) => { const template = availableTemplates[Number(e.target.value)]; if (template) setForm({ ...form, title: template.title, message: template.message }); }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50">{availableTemplates.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select></div><Field label="Schedule (optional)" type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></div>}
        {form.audience === 'Parents' && senderRole !== 'fee_manager' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Class" select value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value, section: '' })} options={structure.classes?.map((item) => item.name) || []} /><Field label="Section" select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} options={selectedClass?.sections?.map((item) => item.name) || []} /></div>}
        {!isDirector && senderRole !== 'fee_manager' && <div><label className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Individual recipient (optional)</label><select value={form.recipient_id} onChange={(e) => setForm({ ...form, recipient_id: e.target.value })} className="h-11 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none"><option value="">Everyone matching the selection</option>{(recipients[form.audience] || []).map((item) => <option key={item.id} value={item.id}>{item.name}{item.class_name ? ` · ${item.class_name}${item.section ? ` / ${item.section}` : ''}` : item.subject ? ` · ${item.subject}` : ''}</option>)}</select></div>}
        <Field label={isDirector ? 'Approval request title *' : 'Notification title'} value={form.title} placeholder={isDirector ? 'e.g. Senior coordinator medical leave' : 'e.g. Parent–teacher meeting this Saturday'} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <TextArea label={isDirector ? 'Executive summary' : 'Message'} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={isDirector ? 3 : 6} placeholder={isDirector ? 'Summarise the current situation and proposed decision.' : 'Write a clear, respectful message...'} />
        {isDirector && <div className="space-y-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <div><p className="text-[14px] font-bold text-indigo-950">Mandatory approval details</p><p className="mt-1 text-[13px] text-indigo-700">These details will appear in the Director App exactly as a decision brief.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Approval type *" select value={form.approval_type} onChange={(e) => setForm({ ...form, approval_type: e.target.value })} options={['Staff & HR', 'Academic', 'Finance', 'Operations', 'Policy & Compliance', 'Other']} /><Field label="Priority *" select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={['Standard', 'High risk', 'Critical']} /></div>
          <TextArea label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why is this request being raised?" />
          <TextArea label="Institutional impact" value={form.institutional_impact} onChange={(e) => setForm({ ...form, institutional_impact: e.target.value })} placeholder="Explain the impact on students, staff, finance or school operations." />
          <TextArea label="Why Director approval is required" value={form.approval_required} onChange={(e) => setForm({ ...form, approval_required: e.target.value })} placeholder="Mention the policy, threshold or authority that requires this decision." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Requested by *" value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} placeholder="e.g. HR Office · Priya Shah" /><Field label="Decision timeline *" type="datetime-local" value={form.decision_due} onChange={(e) => setForm({ ...form, decision_due: e.target.value })} /></div>
          <label className="block rounded-2xl border border-dashed border-indigo-200 bg-white p-5 text-center hover:bg-indigo-50"><input type="file" multiple required={!approvalDocs.length} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => setApprovalDocs([...approvalDocs, ...Array.from(e.target.files || [])])} /><Paperclip className="mx-auto h-5 w-5 text-indigo-500" /><p className="mt-2 text-[13px] font-semibold text-slate-700">Attach supporting documents <span className="text-red-500">*</span></p><p className="mt-1 text-[12px] text-slate-400">PDF, image, Word or Excel · maximum 15 MB per file</p></label>
          {approvalDocs.length > 0 && <div className="space-y-2">{approvalDocs.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3"><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-700">{file.name}</p><p className="text-[12px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</p></div><button type="button" onClick={() => setApprovalDocs(approvalDocs.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-4 w-4" /></button></div>)}</div>}
        </div>}
        <Btn type="submit" icon={saving ? Loader2 : Send} disabled={!isAdmin || saving || !form.title.trim() || !form.message.trim() || !form.channels.length || !directorReady}>{saving ? 'Sending…' : isDirector ? 'Send for Director approval' : form.scheduled_for ? 'Schedule notification' : 'Send notification'}</Btn>
      </form>
    </Card>
    <Card title={isDirector ? 'Approval readiness' : 'Delivery summary'} subtitle={isDirector ? 'Confirm the decision pack before sending.' : 'Confirm the target before sending.'} className="xl:col-span-2"><div className="space-y-4 text-[13px] text-slate-600"><div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><p className="text-[12px] font-semibold uppercase tracking-wider text-indigo-500">Destination</p><p className="mt-2 text-[17px] font-bold text-indigo-950">{audienceConfig[form.audience].app}</p><p className="mt-1 text-[13px] text-indigo-700">{form.class_name ? `${form.class_name}${form.section ? ` / ${form.section}` : ''}` : isDirector ? 'Director approval inbox' : `All ${form.audience}`}</p></div>{isDirector ? <><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800"><p className="font-semibold">Director approval case</p><p className="mt-1 leading-5">Creates the complete approval record with documents, deadline and audit trail in the Director App.</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-800">Required pack</p><p className="mt-2 leading-6">Reason · Institutional impact · Approval authority · Requester · Evidence · Decision timeline</p></div></> : <div className="rounded-xl bg-blue-50 p-4 text-blue-800"><p className="font-semibold">Recorded automatically</p><p className="mt-1 leading-5">The message, recipient app, authorised sender, time and delivery status will appear on the Notification Dashboard.</p></div>}{!isAdmin && <div className="rounded-xl bg-amber-50 p-4 text-amber-800">This role cannot send a notification.</div>}</div></Card>
  </div>;
};

const AutomationRules = ({ rules, isAdmin, onToggle }) => <Card title="Automatic notification rules" subtitle="Routine messages are triggered by their ERP event. Turn off a rule only if your school has an approved alternate process." pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'ERP event' }, { label: 'Recipient' }, { label: 'Automatic action' }, { label: 'Channels' }, { label: 'Status' }]}>{rules.map((rule) => <tr key={rule.key} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4"><p className="text-[14px] font-semibold text-slate-800">{rule.event}</p><p className="mt-0.5 max-w-sm text-[13px] text-slate-400">{rule.description}</p></td><td className="py-4 text-[13px] text-slate-600">{rule.audience}</td><td className="py-4 text-[13px] text-slate-600">Triggered automatically</td><td className="py-4"><div className="flex flex-wrap gap-1">{rule.channels.map((channel) => <Badge key={channel} color="blue">{channel}</Badge>)}</div></td><td className="py-4 pr-6"><button disabled={!isAdmin} onClick={() => onToggle(rule, !rule.enabled)} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${rule.enabled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'} disabled:cursor-not-allowed`}><span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-slate-400'}`} />{rule.enabled ? 'Active' : 'Paused'}</button></td></tr>)}</Table></div></Card>;

const DeliveryHistory = ({ history }) => <Card title="Delivery history" subtitle="Every manual announcement is stored with its audience, chosen channel and queue status." pad="p-0">{history.length ? <div className="overflow-x-auto"><Table columns={[{ label: 'Message' }, { label: 'Audience' }, { label: 'Channels' }, { label: 'Recipients' }, { label: 'Created' }, { label: 'Status' }]}>{history.map((item) => <tr key={item.id} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4"><p className="text-[14px] font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 max-w-sm truncate text-[13px] text-slate-400">{item.message}</p></td><td className="py-4 text-[13px] text-slate-600">{item.audience}{item.class_name ? ` • ${item.class_name}${item.section ? ` / ${item.section}` : ''}` : ''}</td><td className="py-4"><div className="flex flex-wrap gap-1">{(item.channels || []).map((channel) => <Badge key={channel} color="blue">{channel}</Badge>)}</div></td><td className="py-4 text-[13px] font-semibold text-slate-700">{item.recipients_count || 0}</td><td className="py-4 text-[13px] text-slate-500">{item.created ? new Date(item.created).toLocaleString() : '—'}</td><td className="py-4 pr-6"><Badge color={item.status === 'Needs review' ? 'amber' : item.status === 'Scheduled' ? 'blue' : 'green'}>{item.status || 'Queued for review'}</Badge></td></tr>)}</Table></div> : <div className="py-20 text-center"><History className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-[14px] text-slate-400">No manual announcements have been queued yet.</p></div>}</Card>;

export const Communications = () => {
  const [tab, setTab] = useState('overview');
  const [audience, setAudience] = useState('Parents');
  const [schoolClass, setSchoolClass] = useState('All classes');
  const [section, setSection] = useState('All sections');
  const [teacherScope, setTeacherScope] = useState('All teachers');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [reportMode, setReportMode] = useState('month');
  const [reportMonth, setReportMonth] = useState('2026-08');
  const [reportDate, setReportDate] = useState('2026-08-24');
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [structure, setStructure] = useState({ classes: [] });
  const [records, setRecords] = useState([]);
  const [sendError, setSendError] = useState('');
  const loadCommunications = async () => {
    try {
      const [studentRes, teacherRes, setupRes, centerRes] = await Promise.all([api.get('/students'), api.get('/teachers'), api.get('/academic-structure'), api.get('/notifications/center')]);
      setStudents(studentRes.data || []); setTeachers(teacherRes.data || []); setStructure(setupRes.data || { classes: [] });
      const smsHistory = (centerRes.data?.history || []).filter((item) => (item.channels || []).includes('SMS')).map((item) => ({
        id: item.id, message: item.message, audience: item.audience,
        group: item.recipient_id ? (item.recipient_name || 'Individual recipient') : `${item.class_name || 'All classes'}${item.section ? ` · ${item.section}` : ''}`,
        sent: item.created ? new Date(item.created).toLocaleString('en-IN') : '—', date: String(item.created || '').slice(0, 10),
        recipients: Number(item.recipients_count || 0), credits: Number(item.credits ?? (Number(item.recipients_count || 0) * Number(item.sms_units || 1))),
        status: item.status || 'Awaiting Provider',
      }));
      setRecords(smsHistory);
    } catch (error) { setSendError(error.response?.data?.detail || 'Communication records could not be loaded.'); }
  };
  useEffect(() => { loadCommunications(); }, []);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const characterCount = text.length;
  const usesUnicode = /[^\u0000-\u007F]/.test(text);
  const singleMessageLimit = usesUnicode ? 70 : 160;
  const multipartLimit = usesUnicode ? 67 : 153;
  const smsUnits = !characterCount ? 0 : characterCount <= singleMessageLimit ? 1 : Math.ceil(characterCount / multipartLimit);
  const selectedTeacherRecord = teachers.find((item) => item.id === selectedTeacher);
  const recipientRows = audience === 'Parents'
    ? students.filter((item) => item.status !== 'Inactive' && (schoolClass === 'All classes' || item.class_name === schoolClass) && (section === 'All sections' || item.section === section))
    : teachers.filter((item) => item.status !== 'Inactive' && (teacherScope !== 'Individual teacher' || item.id === selectedTeacher));
  const recipients = recipientRows.length;
  const credits = recipients * smsUnits;
  const balance = 12480;
  const filteredRecords = records.filter((row) => reportMode === 'month' ? row.date.startsWith(reportMonth) : row.date === reportDate);
  const downloadReport = () => {
    const header = ['Date', 'Message', 'Audience', 'Class / Section', 'Recipients', 'Status', 'Credits'];
    const lines = filteredRecords.map((row) => [row.sent, row.message, row.audience, row.group, row.recipients, row.status, row.credits]);
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `orison-sms-report-${reportMode === 'month' ? reportMonth : reportDate}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const sendSms = async () => {
    if (!text.trim() || !recipients || (audience === 'Teachers' && teacherScope === 'Individual teacher' && !selectedTeacher)) return;
    setSending(true); setSendError('');
    try {
      await api.post('/notifications/broadcast', { title: 'Direct SMS', message: text.trim(), audience, class_name: schoolClass === 'All classes' ? '' : schoolClass, section: section === 'All sections' ? '' : section, recipient_id: audience === 'Teachers' && teacherScope === 'Individual teacher' ? selectedTeacher : '', channels: ['SMS'] });
      setSent(true); setText(''); await loadCommunications(); setTimeout(() => setSent(false), 3500);
    } catch (error) { setSendError(error.response?.data?.detail || 'SMS could not be added to the provider queue.'); }
    finally { setSending(false); }
  };
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthRecords = records.filter((item) => item.date.startsWith(currentMonth));
  const currentMonthRecipients = currentMonthRecords.reduce((total, item) => total + item.recipients, 0);
  const currentMonthCredits = currentMonthRecords.reduce((total, item) => total + item.credits, 0);
  return (
    <Layout>
      <PageTitle title="Communications" subtitle="Send clear, targeted SMS updates to parents and teachers." />
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-50 p-1">{[['overview','Overview'],['history','Message history']].map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2.5 text-[13px] font-semibold transition ${tab === key ? 'bg-white text-[#C4141B] shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>{label}{key === 'history' && <span className={`ml-2 rounded-full px-2 py-0.5 text-[12px] ${tab === key ? 'bg-red-50 text-[#C4141B]' : 'bg-white text-slate-400'}`}>{records.length}</span>}</button>)}</div>
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 px-4 py-2.5 ring-1 ring-red-100"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#C4141B] shadow-sm"><WalletCards className="h-4 w-4" /></span><div><p className="text-[12px] font-bold uppercase tracking-[0.14em] text-red-400">SMS credit balance</p><p className="text-[16px] font-bold text-[#8F1016]">{balance.toLocaleString()} <span className="text-[12px] font-medium text-red-400">remaining</span></p></div></div>
      </div>
      {tab === 'overview' && <>
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">{[[MessageSquareText,'SMS batches this month',currentMonthRecords.length,`${currentMonthRecipients.toLocaleString()} recipient deliveries`],[CheckCircle2,'Provider status',currentMonthRecords.filter(item => item.status === 'Delivered').length,`${currentMonthRecords.filter(item => item.status !== 'Delivered').length} awaiting provider confirmation`],[WalletCards,'Estimated credits used',currentMonthCredits,balance ? `${balance.toLocaleString()} credits available` : 'Provider balance pending']].map(([Icon,label,value,note],i) => <div key={label} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className={`absolute right-0 top-0 h-20 w-20 translate-x-7 -translate-y-7 rounded-full opacity-60 ${i===0?'bg-red-50':i===1?'bg-emerald-50':'bg-violet-50'}`} /><div className="relative flex items-center gap-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${i===0?'bg-red-50 text-[#C4141B]':i===1?'bg-emerald-50 text-emerald-600':'bg-violet-50 text-violet-600'}`}><Icon className="h-5 w-5" /></span><div><p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[23px] font-bold text-slate-950">{Number(value).toLocaleString()}</p><p className="mt-1 text-[12px] text-slate-400">{note}</p></div></div></div>)}</div>
        <Card pad="p-0" className="overflow-hidden rounded-3xl border-slate-100 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/70 px-6 py-5"><div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#C4141B]"><Send className="h-4 w-4" /></span><h2 className="text-[16px] font-bold">Compose new SMS</h2></div><p className="mt-2 text-[13px] text-slate-400">Choose recipients, write your message and review credit usage.</p></div><Badge color="green">Direct SMS</Badge></div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px]">
            <div className="p-6">
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">Send to</p>
              <div className="mb-5 grid gap-3 sm:grid-cols-2">{[['Parents',Users,'Families and guardians'],['Teachers',GraduationCap,'Faculty members']].map(([name,Icon,note]) => <button key={name} onClick={() => setAudience(name)} className={`flex items-center gap-3 rounded-xl border p-4 text-left ${audience === name ? 'border-[#C4141B] bg-red-50/50 ring-1 ring-[#C4141B]' : 'border-slate-200'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${audience===name?'bg-[#C4141B] text-white':'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></span><span><b className="block text-[13px]">{name}</b><small className="text-[12px] text-slate-400">{note}</small></span></button>)}</div>
              <div className="mb-5 grid gap-4 sm:grid-cols-2"><label className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Class<select value={schoolClass} onChange={(e)=>{setSchoolClass(e.target.value);setSection('All sections');}} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] normal-case tracking-normal"><option value="All classes" label="All classes" />{(structure.classes || []).map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Section<select value={section} onChange={(e)=>setSection(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] normal-case tracking-normal"><option value="All sections" label="All sections" />{(schoolClass === 'All classes' ? [...new Set((structure.classes || []).flatMap(item => (item.sections || []).map(sectionItem => sectionItem.name)))] : ((structure.classes || []).find(item => item.name === schoolClass)?.sections || []).map(item => item.name)).map(name=><option key={name} value={name}>{name}</option>)}</select></label></div>
              {audience === 'Teachers' && <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-violet-700">Teacher recipients</p>
                <div className="grid gap-3 sm:grid-cols-2">{['All teachers','Individual teacher'].map(scope => <button type="button" key={scope} onClick={() => setTeacherScope(scope)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${teacherScope === scope ? 'border-violet-500 bg-white ring-1 ring-violet-400' : 'border-violet-100 bg-white/70'}`}><span className={`h-4 w-4 rounded-full border-2 p-[3px] ${teacherScope === scope ? 'border-violet-600 bg-violet-600 bg-clip-content' : 'border-slate-300'}`} /><span><b className="block text-[13px] text-slate-800">{scope}</b><small className="text-[12px] text-slate-400">{scope === 'All teachers' ? 'Send to every matching teacher' : 'Select one faculty member'}</small></span></button>)}</div>
                {teacherScope === 'Individual teacher' && <label className="mt-4 block text-[12px] font-bold uppercase tracking-wider text-slate-500">Select teacher<select value={selectedTeacher} onChange={(e)=>setSelectedTeacher(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-[13px] font-medium normal-case tracking-normal outline-none focus:border-violet-400"><option value="">Choose teacher</option>{teachers.filter(item => item.status !== 'Inactive').map(item=><option key={item.id} value={item.id}>{item.name} · {item.subject || item.department || 'Teacher'}</option>)}</select></label>}
              </div>}
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Message <span className="font-normal normal-case tracking-normal text-slate-300">Required</span></p>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 focus-within:border-red-300"><textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="Type your SMS message here…" className="h-32 w-full resize-none p-4 text-[13px] outline-none" /><div className="grid grid-cols-3 border-t border-slate-100 px-4 py-2 text-[12px] text-slate-400"><span>{characterCount} characters</span><span className="text-center">{words} word{words === 1 ? '' : 's'}</span><span className="text-right font-semibold text-[#C4141B]">{smsUnits} credit{smsUnits === 1 ? '' : 's'} per recipient</span></div></div>
              <div className={`mt-3 flex gap-3 rounded-xl p-3 ${smsUnits>1?'bg-amber-50 text-amber-700':'bg-blue-50 text-blue-700'}`}><Info className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-[12px] leading-relaxed"><b className="block">Live SMS credit calculation</b>{usesUnicode ? `This message contains Unicode or a regional language. The first SMS supports ${singleMessageLimit} characters; longer messages use ${multipartLimit} characters per credit.` : `Standard SMS supports ${singleMessageLimit} characters. Longer messages use ${multipartLimit} characters per credit.`}</p></div>
            </div>
            <aside className="border-t border-slate-100 bg-slate-50/70 p-6 xl:border-l xl:border-t-0"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Live credit summary</p><div className="mt-4 rounded-xl border border-slate-100 bg-white p-4"><p className="text-[12px] text-slate-400">Sending to</p><p className="mt-1 text-[14px] font-bold">{audience === 'Teachers' && teacherScope === 'Individual teacher' ? (selectedTeacherRecord?.name || 'Choose teacher') : audience}</p><p className="mt-1 text-[12px] text-slate-400">{audience === 'Teachers' ? `${teacherScope}${teacherScope === 'Individual teacher' && selectedTeacherRecord ? ` · ${selectedTeacherRecord.subject || selectedTeacherRecord.department || 'Teacher'}` : ''} · ` : ''}{schoolClass} · {section}</p></div><div className="mt-4 space-y-3 text-[12px] text-slate-500"><div className="flex justify-between"><span>Message characters</span><b className="text-slate-800">{characterCount}</b></div><div className="flex justify-between"><span>Recipients</span><b className="text-slate-800">{recipients}</b></div><div className="flex justify-between"><span>Credits per recipient</span><b className="text-slate-800">{smsUnits}</b></div><div className="border-t border-slate-200 pt-4"><div className="flex items-end justify-between"><span>Estimated credits</span><b className="text-[22px] text-[#C4141B]">{credits.toLocaleString()}</b></div></div><div className={`flex justify-between rounded-lg p-3 ${balance - credits < 0 ? 'bg-red-100 text-red-800' : 'bg-red-50 text-red-700'}`}><span>Balance after sending</span><b>{(balance-credits).toLocaleString()}</b></div></div>{sendError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-[12px] font-semibold text-red-700">{sendError}</p>}<button onClick={sendSms} disabled={!text.trim() || !recipients || credits > balance || sending} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C4141B] text-[13px] font-semibold text-white disabled:bg-slate-300">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? 'Adding to queue…' : 'Send message'}</button><p className="mt-2 text-center text-[12px] text-slate-400">Credit values update instantly as you type.</p></aside>
          </div>
        </Card>
      </>}
      {tab === 'history' && <Card pad="p-0" className="overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="flex items-center gap-2"><History className="h-4 w-4 text-[#C4141B]" /><h2 className="text-[15px] font-bold">Message history</h2></div><p className="mt-1 text-[12px] text-slate-400">Filter direct SMS records by calendar date or month and download the report.</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <div><p className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">Report period</p><div className="flex rounded-lg bg-slate-100 p-1">{[['month','Month'],['date','Date']].map(([key,label]) => <button key={key} onClick={() => setReportMode(key)} className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${reportMode === key ? 'bg-white text-[#C4141B] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div></div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-slate-400"><span className="mb-1.5 block">{reportMode === 'month' ? 'Select month' : 'Select date'}</span><span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type={reportMode === 'month' ? 'month' : 'date'} value={reportMode === 'month' ? reportMonth : reportDate} onChange={(e) => reportMode === 'month' ? setReportMonth(e.target.value) : setReportDate(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-red-300" /></span></label>
              <button onClick={downloadReport} disabled={!filteredRecords.length} className="flex h-10 items-center gap-2 rounded-lg bg-[#C4141B] px-4 text-[12px] font-semibold text-white shadow-md shadow-red-100 hover:bg-[#A91116] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"><Download className="h-4 w-4" />Download report</button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><p className="text-[12px] text-slate-500"><b className="text-slate-800">{filteredRecords.length}</b> SMS record{filteredRecords.length === 1 ? '' : 's'} found</p><p className="text-[12px] text-slate-500">Total credits used: <b className="text-[#C4141B]">{filteredRecords.reduce((total, row) => total + row.credits, 0).toLocaleString()}</b></p></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-slate-50 text-left text-[12px] uppercase tracking-wider text-slate-400"><th className="px-6 py-3">Message</th><th className="px-4 py-3">Audience</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Recipients</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Credits</th></tr></thead><tbody>{filteredRecords.map(row=><tr key={row.id} className="border-b border-slate-50"><td className="max-w-md px-6 py-4"><p className="text-[13px] font-medium text-slate-700">{row.message}</p><p className="mt-1 text-[12px] text-slate-400">{row.group}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${row.audience==='Parents'?'bg-red-50 text-[#C4141B]':'bg-violet-50 text-violet-600'}`}>{row.audience}</span></td><td className="whitespace-nowrap px-4 py-4 text-[12px] text-slate-500">{row.sent}</td><td className="px-4 py-4 text-[12px] font-semibold">{row.recipients}</td><td className="px-4 py-4 text-[12px] font-semibold text-amber-600">● {row.status}</td><td className="px-4 py-4 text-[12px] font-semibold">{row.credits}</td></tr>)}{!filteredRecords.length && <tr><td colSpan="6" className="px-6 py-16 text-center"><CalendarDays className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-[13px] font-medium text-slate-500">No SMS records found for this {reportMode}.</p><p className="mt-1 text-[12px] text-slate-400">Choose a different reporting period.</p></td></tr>}</tbody></table></div>
      </Card>}
      {sent && <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white shadow-2xl"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><div><p className="text-[13px] font-semibold">SMS added to delivery queue</p><p className="text-[12px] text-white/50">Credit estimate has been reserved.</p></div></div>}
    </Layout>
  );
};
