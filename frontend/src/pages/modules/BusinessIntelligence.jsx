import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { Badge, Btn, Card, PageTitle, StatCards, Table } from '../../components/Shared';
import api from '../../api';
import { AlertTriangle, CalendarClock, CheckCircle2, Download, MessageSquareText, Plus, ShieldAlert, Sparkles, UserRoundCheck, Users } from 'lucide-react';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const stages = ['Enquiry', 'Contacted', 'Visit', 'Application', 'Selected', 'Admitted', 'Lost'];

export const AdmissionsCRM = () => {
  const [leads, setLeads] = useState([]), [data, setData] = useState({ funnel: [], stale: [], lost_reasons: [] }); const [form, setForm] = useState({ name: '', phone: '', interested_class: '', counsellor: '', stage: 'Enquiry', lost_reason: '' });
  const load = useCallback(async () => { const [l, d] = await Promise.all([api.get('/admission-leads'), api.get('/admissions-intelligence')]); setLeads(l.data); setData(d.data); }, []); useEffect(() => { load().catch(() => {}); }, [load]);
  const save = async () => { if (!form.name || !form.phone) return; await api.post('/admission-leads', form); setForm({ name: '', phone: '', interested_class: '', counsellor: '', stage: 'Enquiry', lost_reason: '' }); load(); };
  return <Layout><PageTitle title="Admissions CRM" subtitle="Track every enquiry through follow-up, visit, application and admission." actions={<Btn icon={Plus} onClick={save}>Add enquiry</Btn>} />
    <StatCards items={[{ label: 'Total enquiries', value: data.funnel[0]?.count || 0, icon: Users }, { label: 'Admissions', value: data.funnel.find((x) => x.stage === 'Admitted')?.count || 0, icon: UserRoundCheck, tint: 'bg-green-50 text-green-600' }, { label: 'Conversion rate', value: `${data.conversion || 0}%`, icon: UserRoundCheck, tint: 'bg-blue-50 text-blue-600' }, { label: 'No activity >48 hrs', value: data.stale.length, icon: AlertTriangle, tint: 'bg-indigo-50 text-[#4F46E5]' }]} />
    <Card title="New enquiry"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Parent name" className="h-10 border rounded-lg px-3 text-[13px]" /><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" className="h-10 border rounded-lg px-3 text-[13px]" /><input value={form.interested_class} onChange={(e) => setForm({ ...form, interested_class: e.target.value })} placeholder="Interested class" className="h-10 border rounded-lg px-3 text-[13px]" /><input value={form.counsellor} onChange={(e) => setForm({ ...form, counsellor: e.target.value })} placeholder="Counsellor" className="h-10 border rounded-lg px-3 text-[13px]" /><select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="h-10 border rounded-lg px-3 text-[13px]">{stages.map((x) => <option key={x}>{x}</option>)}</select><input value={form.lost_reason} onChange={(e) => setForm({ ...form, lost_reason: e.target.value })} placeholder="Lost reason, if applicable" className="h-10 border rounded-lg px-3 text-[13px]" /></div></Card>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5"><Card title="Admission funnel">{data.funnel.map((x) => <div key={x.stage} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0"><span className="text-[13px]">{x.stage}</span><span className="font-semibold text-[13px]">{x.count}</span></div>)}</Card><Card title="Leads needing follow-up"><div className="text-[13px] text-[#666]">{data.stale.length ? `${data.stale.length} enquiries have had no follow-up activity for 48 hours.` : 'All enquiries have recent activity.'}</div></Card></div>
    <Card title="Enquiry pipeline" className="mt-5" pad="p-0"><Table columns={[{ label: 'Parent' }, { label: 'Phone' }, { label: 'Class' }, { label: 'Counsellor' }, { label: 'Stage' }, { label: 'Automated follow-up' }]}>{leads.map((x) => <tr key={x.id} className="border-b border-gray-50"><td className="px-6 py-3 font-medium text-[13px]">{x.name}</td><td className="py-3 text-[13px]">{x.phone}</td><td className="py-3 text-[13px]">{x.interested_class || '—'}</td><td className="py-3 text-[13px]">{x.counsellor || 'Unassigned'}</td><td className="py-3"><Badge color={x.stage === 'Admitted' ? 'green' : x.stage === 'Lost' ? 'red' : 'blue'}>{x.stage}</Badge></td><td className="py-3">Day 0, 1, 3, 7, 14</td></tr>)}</Table>{!leads.length && <div className="py-8 text-center text-[13px] text-[#999]">Add an enquiry to start the admissions funnel.</div>}</Card>
  </Layout>;
};

const outcomeOptions = ['Parent reached', 'No answer', 'Phone switched off', 'Wrong number', 'Promise to pay', 'Requested instalment plan', 'Fee disputed', 'Paid — receipt pending'];

const FollowUpModal = ({ item, onClose, onSave }) => {
  const [form, setForm] = useState({
    outcome: '',
    notes: item.parent_response || '',
    next_follow_up: item.next_follow_up || '',
    promise_amount: item.promise_amount || '',
    promise_date: item.promise_date || '',
  });
  const [saving, setSaving] = useState(false);
  const needsPromise = form.outcome === 'Promise to pay' || form.outcome === 'Requested instalment plan';

  const submit = async () => {
    if (!form.outcome) return;
    const statusMap = {
      'Parent reached': 'Contacted',
      'No answer': 'Attempted — No Answer',
      'Phone switched off': 'Attempted — No Answer',
      'Wrong number': 'Escalated',
      'Promise to pay': 'Promise to Pay',
      'Requested instalment plan': 'Payment Plan',
      'Fee disputed': 'Disputed',
      'Paid — receipt pending': 'Contacted',
    };
    setSaving(true);
    try {
      await onSave(item.fee_id, {
        last_contact: new Date().toISOString().slice(0, 10),
        parent_response: `${form.outcome}${form.notes ? ` — ${form.notes}` : ''}`,
        next_follow_up: form.next_follow_up,
        promise_amount: needsPromise ? Number(form.promise_amount || 0) : 0,
        promise_date: needsPromise ? form.promise_date : '',
        case_status: statusMap[form.outcome] || 'Open',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/45 p-4">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-[#111a3a] to-[#4F46E5] px-6 py-5 text-white">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-200">Recovery follow-up</p>
            <p className="mt-1 font-poppins text-[22px] font-bold">Log follow-up outcome</p>
            <p className="mt-1 text-[13px] text-indigo-100">{item.student_name} · {item.fee_name} · {money(item.due)} outstanding</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold">Close</button>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]"><span className="rounded-full bg-white/10 px-3 py-1.5">{item.parent_name || 'Parent'}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{item.parent_phone || 'Phone unavailable'}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{item.class_name || '—'} / {item.section || '—'}</span></div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <label className="text-[12px] font-medium text-[#555] md:col-span-2">Follow-up outcome<select className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-[#f7f8f9] px-3 text-[13px]" value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })}><option value="">Select what happened</option>{outcomeOptions.map((outcome) => <option key={outcome}>{outcome}</option>)}</select></label>
          {needsPromise && <><label className="text-[12px] font-medium text-[#555]">Promised amount<input className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-[#f7f8f9] px-3 text-[13px]" type="number" min="0" value={form.promise_amount} onChange={(event) => setForm({ ...form, promise_amount: event.target.value })} placeholder="0.00" /></label><label className="text-[12px] font-medium text-[#555]">Promised payment date<input className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-[#f7f8f9] px-3 text-[13px]" type="date" value={form.promise_date} onChange={(event) => setForm({ ...form, promise_date: event.target.value })} /></label></>}
          <label className="text-[12px] font-medium text-[#555]">Next follow-up date<input className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-[#f7f8f9] px-3 text-[13px]" type="date" value={form.next_follow_up} onChange={(event) => setForm({ ...form, next_follow_up: event.target.value })} /></label>
          <label className="md:col-span-2 text-[12px] font-medium text-[#555]">Notes<textarea className="mt-1 h-20 w-full rounded-lg border border-gray-200 bg-[#f7f8f9] px-3 py-2 text-[13px]" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Reason, commitment, dispute details, preferred contact time or agreed next step" /></label>
          <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[12px] leading-5 text-blue-800"><b>No audio is recorded.</b> The website saves only the follow-up result, payment promise, notes and next action. Payment is completed only through an official fee receipt.</div>
          <div className="md:col-span-2 flex justify-end gap-3"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={submit} disabled={saving || !form.outcome}>{saving ? 'Saving…' : 'Save follow-up outcome'}</Btn></div>
        </div>
      </div>
    </div>
  );
};

export const CollectionIntelligence = () => {
  const [data, setData] = useState({ buckets: [], fee_breakdown: [], cases: [], today: {}, reconciliation: {} });
  const [selectedAction, setSelectedAction] = useState('broken_promises');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedFeeType, setSelectedFeeType] = useState('');
  const [selectedFeePeriod, setSelectedFeePeriod] = useState('current');
  const [configuredAcademicYear, setConfiguredAcademicYear] = useState('');
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [collectionResponse, structureResponse] = await Promise.all([
      api.get('/collections-intelligence'),
      api.get('/academic-structure'),
    ]);
    setData(collectionResponse.data);
    setConfiguredAcademicYear(structureResponse.data?.academic_year || '');
  }, []);

  useEffect(() => { load().catch(() => setNotice('Could not load collection data.')); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const cases = useMemo(() => data.cases || [], [data.cases]);
  const isOpen = (item) => item.case_status !== 'Paid' && item.case_status !== 'Closed';
  const criticalCases = cases.filter((item) => Number(item.days_overdue || 0) > 60 && isOpen(item));
  const highPriorityCases = cases.filter((item) => Number(item.days_overdue || 0) >= 30 && Number(item.days_overdue || 0) <= 60 && isOpen(item));
  const followUpsToday = cases.filter((item) => item.next_follow_up && item.next_follow_up <= today);
  const brokenPromises = cases.filter((item) => item.promise_date && item.promise_date < today && isOpen(item));
  const contactIssues = cases.filter((item) => !item.parent_phone || item.case_status === 'Attempted — No Answer' || item.case_status === 'Escalated');
  const upcomingReminders = cases.filter((item) => item.bucket === 'Upcoming');
  const todayFollowUps = cases.filter((item) => item.last_contact === today);
  const classOptions = [...new Set(cases.map((item) => item.class_name).filter(Boolean))].sort();
  const sectionOptions = [...new Set(cases.filter((item) => !selectedClass || item.class_name === selectedClass).map((item) => item.section).filter(Boolean))].sort();
  const feeTypeOptions = [...new Set(cases.map((item) => item.fee_name).filter(Boolean))].sort();
  const academicYearOptions = [...new Set(cases.map((item) => item.academic_year).filter(Boolean))].sort().reverse();
  const currentAcademicYear = configuredAcademicYear || academicYearOptions[0] || '';
  const previousAcademicYear = academicYearOptions.find((year) => year !== currentAcademicYear) || '';
  const actionOptions = [
    { value: 'broken_promises', label: 'Broken payment promises', help: 'Verify receipt first; if unpaid, contact the parent and agree a new commitment or escalate.', count: brokenPromises.length },
    { value: 'critical', label: 'Critical — over 60 days', help: 'Call the parent, understand the reason and agree an approved payment plan or escalate.', count: criticalCases.length },
    { value: 'high_priority', label: 'High priority — 30 to 60 days', help: 'Contact these families before dues become critical.', count: highPriorityCases.length },
    { value: 'followups_today', label: 'Follow-ups due today', help: 'Complete previously scheduled follow-ups and record the outcome.', count: followUpsToday.length },
    { value: 'contact_issues', label: 'Contact problems', help: 'Correct phone details or use an alternate communication route.', count: contactIssues.length },
    { value: 'upcoming_reminders', label: 'Upcoming dues', help: 'Send reminders before the due date to prevent overdue cases.', count: upcomingReminders.length },
    { value: 'all_open', label: 'All unpaid fees', help: 'See every pending fee separately, such as tuition, books and transport.', count: cases.filter(isOpen).length },
  ];
  const selectedActionInfo = actionOptions.find((item) => item.value === selectedAction) || actionOptions[0];
  const actionCases = useMemo(() => {
    if (selectedAction === 'followups_today') return followUpsToday;
    if (selectedAction === 'critical') return criticalCases;
    if (selectedAction === 'high_priority') return highPriorityCases;
    if (selectedAction === 'contact_issues') return contactIssues;
    if (selectedAction === 'upcoming_reminders') return upcomingReminders;
    if (selectedAction === 'all_open') return cases.filter(isOpen);
    return brokenPromises;
  }, [selectedAction, cases, brokenPromises, criticalCases, highPriorityCases, followUpsToday, contactIssues, upcomingReminders]);
  const shownCases = useMemo(() => actionCases.filter((item) => {
    const matchesPeriod = selectedFeePeriod === 'all'
      || (selectedFeePeriod === 'previous'
        ? Boolean(previousAcademicYear) && item.academic_year === previousAcademicYear
        : !item.academic_year || item.academic_year === currentAcademicYear);
    return matchesPeriod
      && (!selectedClass || item.class_name === selectedClass)
      && (!selectedSection || item.section === selectedSection)
      && (!selectedFeeType || item.fee_name === selectedFeeType);
  }), [actionCases, selectedClass, selectedSection, selectedFeeType, selectedFeePeriod, currentAcademicYear, previousAcademicYear]);

  const saveFollowUp = async (feeId, form) => {
    try {
      await api.post(`/collections-intelligence/${feeId}/follow-up`, form);
      setEditing(null);
      setNotice('Follow-up outcome saved and the recovery queue has been updated.');
      load();
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Could not save the follow-up.');
    }
  };

  const downloadTodayFollowUpReport = () => {
    const header = ['Student', 'Admission No', 'Class', 'Section', 'Parent', 'Phone', 'Fee Head', 'Outstanding', 'Outcome', 'Next Follow-up', 'Promise Amount', 'Promise Date', 'Notes'];
    const rows = todayFollowUps.map((item) => [item.student_name, item.admission_no, item.class_name, item.section, item.parent_name, item.parent_phone, item.fee_name, item.due, item.case_status, item.next_follow_up, item.promise_amount, item.promise_date, item.parent_response]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `KDM-fee-recovery-update-${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const caseGuidance = (item) => {
    if (!item.parent_phone) return { signal: 'Parent number missing', action: 'Update the parent phone number before follow-up', color: 'red' };
    if (item.promise_date && item.promise_date < today && isOpen(item)) return { signal: 'Payment promise missed', action: 'Call parent, confirm payment status and escalate if required', color: 'red' };
    if (item.next_follow_up && item.next_follow_up <= today) return { signal: 'Follow-up due today', action: 'Call parent today and record the response', color: 'amber' };
    if (Number(item.days_overdue || 0) > 60) return { signal: 'Overdue by more than 60 days', action: 'Call parent and discuss an approved payment plan', color: 'red' };
    if (Number(item.days_overdue || 0) >= 30) return { signal: 'Overdue by 30–60 days', action: 'Call parent and agree a clear payment date', color: 'amber' };
    if (item.bucket === 'Upcoming') return { signal: 'Payment due soon', action: 'Send a due-date reminder to the parent', color: 'blue' };
    return { signal: 'Payment pending', action: 'Call parent and confirm the expected payment date', color: 'blue' };
  };
  const criticalAmount = criticalCases.reduce((sum, item) => sum + Number(item.due || 0), 0);
  const brokenPromiseAmount = brokenPromises.reduce((sum, item) => sum + Number(item.due || 0), 0);
  const promisesCapturedToday = todayFollowUps.filter((item) => item.case_status === 'Promise to Pay' || item.case_status === 'Payment Plan').length;

  return (
    <Layout>
      <PageTitle title="Collection Intelligence" subtitle="A practical recovery workspace that decides what needs attention, why it matters and what the fee team should do next." actions={<Btn variant="outline" onClick={load}>Refresh intelligence</Btn>} />

      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('saved') ? 'border-green-100 bg-green-50 text-green-700' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}>{notice}</div>}

      <div className="mb-5 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#101936] via-[#23265c] to-[#4F46E5] p-6 text-white shadow-lg"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-200"><Sparkles size={15} /> Recovery command centre</div><h2 className="mt-3 text-2xl font-bold">Today’s recovery plan is ready</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-indigo-100">Every unpaid fee head—tuition, books, transport or another fee—is evaluated separately using ageing, promises, ownership, contactability and follow-up dates.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4"><p className="text-[11px] uppercase tracking-wider text-indigo-200">Open outstanding</p><p className="mt-1 text-3xl font-bold">{money(data.outstanding)}</p><p className="mt-1 text-[12px] text-indigo-100">{cases.filter(isOpen).length} fee-head cases</p></div></div></div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{[{ label: 'Broken promises', value: brokenPromises.length, detail: money(brokenPromiseAmount), icon: ShieldAlert, tint: 'text-red-600 bg-red-50', action: 'broken_promises' }, { label: 'Critical over 60 days', value: criticalCases.length, detail: money(criticalAmount), icon: AlertTriangle, tint: 'text-orange-600 bg-orange-50', action: 'critical' }, { label: 'Due for follow-up', value: followUpsToday.length, detail: 'Needs action today', icon: CalendarClock, tint: 'text-blue-600 bg-blue-50', action: 'followups_today' }, { label: 'Contact problems', value: contactIssues.length, detail: 'Needs corrected contact details', icon: MessageSquareText, tint: 'text-violet-600 bg-violet-50', action: 'contact_issues' }].map((metric) => <button key={metric.label} onClick={() => setSelectedAction(metric.action)} className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedAction === metric.action ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-100 bg-white'}`}><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tint}`}><metric.icon size={19} /></div><p className="mt-4 text-2xl font-bold text-gray-900">{metric.value}</p><p className="mt-1 text-[13px] font-semibold text-gray-800">{metric.label}</p><p className="mt-1 text-[11px] text-gray-500">{metric.detail}</p></button>)}</div>

      <Card className="mb-5" title="Choose the work queue" subtitle="Select the recovery problem first. Class and section filters are optional.">
        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-gray-700">Fee period</p>
          <div className="inline-flex flex-wrap gap-2 rounded-xl bg-gray-50 p-1.5">
            {[
              { value: 'current', label: `Current AY${currentAcademicYear ? ` · ${currentAcademicYear}` : ''}` },
              { value: 'previous', label: `Previous AY${previousAcademicYear ? ` · ${previousAcademicYear}` : ''}`, disabled: !previousAcademicYear },
              { value: 'all', label: 'All academic years' },
            ].map((period) => (
              <button
                key={period.value}
                type="button"
                disabled={period.disabled}
                onClick={() => setSelectedFeePeriod(period.value)}
                className={`rounded-lg px-4 py-2.5 text-[12px] font-semibold transition ${selectedFeePeriod === period.value ? 'bg-[#4F46E5] text-white shadow-sm' : 'bg-white text-gray-600 hover:text-indigo-600'} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {period.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">Changing the fee period does not reset the Class, Section or Fee Type filters.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-semibold text-gray-700">Recovery queue
            <select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 text-[14px] font-semibold text-[#293241]">
              {actionOptions.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-gray-700">Class filter
            <select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection(''); }} className="mt-2 h-12 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 text-[14px] font-semibold text-[#293241]">
              <option value="">All classes</option>{classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-gray-700">Section filter
            <select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 text-[14px] font-semibold text-[#293241]">
              <option value="">All sections</option>{sectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-gray-700">Fee type filter
            <select value={selectedFeeType} onChange={(event) => setSelectedFeeType(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#dfe4ea] bg-white px-3 text-[14px] font-semibold text-[#293241]">
              <option value="">All fee types</option>{feeTypeOptions.map((feeType) => <option key={feeType} value={feeType}>{feeType}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3"><MessageSquareText className="mt-0.5 text-indigo-600" size={17} /><p className="text-[12px] leading-5 text-indigo-900"><b>Recommended workflow:</b> {selectedActionInfo.help}</p></div>
      </Card>

      <Card className="mb-5" title="Parent fee follow-up list" subtitle={`${shownCases.length} pending fee${shownCases.length === 1 ? '' : 's'} need attention. Each row clearly explains why and what to do next.`} pad="p-0">
        <div className="overflow-x-auto">
          <Table columns={[{ label: 'Student' }, { label: 'Fee and pending amount' }, { label: 'Why follow-up is needed' }, { label: 'What admin should do' }, { label: 'Follow-up' }]}> 
            {shownCases.map((item) => (
              <tr key={item.id || item.fee_id} className="border-b border-gray-50 hover:bg-indigo-50/20">
                <td className="px-6 py-4 text-[13px] font-semibold">{item.student_name}<span className="block text-[11px] font-normal text-[#8791a2]">{item.class_name || '—'} / {item.section || '—'} · {item.admission_no || '—'}</span><span className="mt-1 block text-[11px] font-normal text-[#777]">Parent: {item.parent_name || '—'} · {item.parent_phone || 'phone unavailable'}</span></td>
                <td className="py-4 text-[13px] font-semibold text-indigo-700">{item.fee_name || 'Fee'}<span className="mt-1 block text-[15px] font-bold text-gray-900">{money(item.due)}</span><span className={`mt-1 block text-[11px] font-medium ${Number(item.days_overdue || 0) > 60 ? 'text-red-600' : 'text-gray-500'}`}>{item.days_overdue ? `${item.days_overdue} days overdue` : 'Not overdue'}</span></td>
                <td className="py-4 text-[12px]"><Badge color={caseGuidance(item).color}>{caseGuidance(item).signal}</Badge><span className="mt-2 block max-w-[220px] text-[#777]">{item.parent_response || 'No previous follow-up result'}</span></td>
                <td className="py-4 text-[12px] font-semibold text-gray-800"><span className="block max-w-[250px]">{caseGuidance(item).action}</span><span className="mt-2 block font-normal text-[#777]">{item.next_follow_up ? `Next follow-up: ${item.next_follow_up}` : 'Set the next date after contacting the parent'}</span></td>
                <td className="py-4 pr-6"><button onClick={() => setEditing(item)} className="whitespace-nowrap rounded-lg bg-[#4F46E5] px-3 py-2 text-[11px] font-semibold text-white">Log outcome</button></td>
              </tr>
            ))}
          </Table>
          {!shownCases.length && <div className="py-14 text-center text-[13px] text-[#999]"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={28} />No unpaid fees match the selected academic year and filters.</div>}
        </div>
      </Card>

      <Card title="Daily management handover" subtitle="A concise audit of follow-up outcomes—not audio recordings." actions={<Btn variant="outline" icon={Download} onClick={downloadTodayFollowUpReport}>Download today’s update</Btn>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-xl bg-gray-50 p-4"><p className="text-[11px] uppercase tracking-wide text-gray-500">Follow-ups completed</p><p className="mt-1 text-xl font-bold">{todayFollowUps.length}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-[11px] uppercase tracking-wide text-emerald-700">Promises captured</p><p className="mt-1 text-xl font-bold text-emerald-700">{promisesCapturedToday}</p></div><div className="rounded-xl bg-indigo-50 p-4"><p className="text-[11px] uppercase tracking-wide text-indigo-700">Cases remaining</p><p className="mt-1 text-xl font-bold text-indigo-700">{cases.filter(isOpen).length}</p></div></div>
        <p className="mt-4 text-[12px] leading-5 text-[#647082]">The report includes the exact fee head, balance, parent contact, responsible owner, outcome, promise and next follow-up date for KDM review.</p>
      </Card>

      {editing && <FollowUpModal item={editing} onClose={() => setEditing(null)} onSave={saveFollowUp} />}
    </Layout>
  );
};
