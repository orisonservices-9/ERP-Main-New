import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Badge, Btn, Card, PageTitle, StatCards, Table } from '../../components/Shared';
import api from '../../api';
import { Activity, AlertTriangle, BookOpenCheck, CalendarClock, CheckCircle2, ClipboardPlus, HeartPulse, Plus, Users } from 'lucide-react';

const Select = ({ value, onChange, children }) => <select value={value} onChange={onChange} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px]">{children}</select>;
const Empty = ({ children }) => <div className="py-8 text-center text-[13px] text-[#999]">{children}</div>;

export const AcademicActionCenter = () => {
  const [data, setData] = useState({ actions: [], risks: [] }); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState(''); const navigate = useNavigate();
  const load = useCallback(async () => { setLoading(true); try { setData((await api.get('/academic-intelligence')).data); } finally { setLoading(false); } }, []);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);
  const run = async () => { const r = await api.post('/academic-intelligence/run'); setNotice(`${r.data.created} intervention case(s) created automatically; ${r.data.existing} existing case(s) kept.`); load(); };
  const health = data.academic_health || { score: null, status: 'Awaiting data', coverage: 0, indicators: [] };
  const healthColor = health.status === 'Healthy' ? 'green' : health.status === 'Needs attention' ? 'amber' : health.status === 'Critical' ? 'red' : 'gray';
  return <Layout><PageTitle title="Academic Action Center" subtitle="Data → risk → action → intervention → result." actions={<><Btn variant="outline" onClick={load}>Refresh</Btn><Btn icon={ClipboardPlus} onClick={run}>Auto-detect risks</Btn></>} />
    <StatCards items={[{ label: 'Academic Health Score', value: health.score === null ? 'Awaiting data' : `${health.score}/100`, icon: HeartPulse, tint: health.status === 'Healthy' ? 'bg-green-50 text-green-600' : health.status === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600' }, { label: 'Students At Risk', value: data.at_risk_students || 0, icon: AlertTriangle, tint: 'bg-indigo-50 text-[#4F46E5]' }, { label: 'Syllabus Behind', value: data.syllabus_behind || 0, icon: BookOpenCheck, tint: 'bg-amber-50 text-amber-600' }, { label: 'Open Interventions', value: data.interventions_open || 0, icon: ClipboardPlus, tint: 'bg-blue-50 text-blue-600' }]} />
    {notice && <div className="mb-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-[13px] text-green-700">{notice}</div>}
    <Card title="Academic health calculation" subtitle="Only saved academic evidence contributes to this score; missing information is never treated as zero." className="mb-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
        <div><p className="text-[12px] font-medium uppercase tracking-wide text-[#777]">Current status</p><div className="mt-1 flex items-center gap-2"><Badge color={healthColor}>{health.status}</Badge><span className="text-[13px] text-[#555]">{health.score === null ? 'Enter the missing academic evidence to calculate the score.' : `${health.score} out of 100`}</span></div></div>
        <div className="min-w-[220px]"><div className="mb-1 flex justify-between text-[12px] text-[#666]"><span>Data coverage</span><strong>{health.coverage || 0}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${health.coverage || 0}%` }} /></div></div>
      </div>
      <div className="space-y-4">{(health.indicators || []).map((indicator) => <div key={indicator.key} className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(210px,1.3fr)_70px_minmax(180px,1fr)_minmax(220px,1.3fr)]">
        <div><p className="text-[13px] font-semibold text-[#333]">{indicator.label}</p><p className="text-[11px] text-[#888]">Weight: {indicator.weight}%</p></div>
        <div className="text-[13px] font-semibold text-[#333]">{indicator.available ? `${indicator.value}%` : '—'}</div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${!indicator.available ? 'bg-gray-200' : indicator.value >= 80 ? 'bg-green-500' : indicator.value >= 65 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${indicator.available ? indicator.value : 0}%` }} /></div>
        <p className="text-[12px] text-[#777]">{indicator.available ? indicator.suggested_action : 'Awaiting data'}</p>
      </div>)}</div>
      {health.weakest_indicator && <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"><strong>Priority improvement:</strong> {health.weakest_indicator.label}. {health.weakest_indicator.suggested_action}</div>}
    </Card>
    <Card title="Today's Priority Actions" subtitle="Ranked from the Academic Health calculation so the school knows what to improve first.">{data.actions.length ? data.actions.map((a, i) => { const actionColor = a.status === 'Critical' ? 'red' : a.status === 'Needs attention' ? 'amber' : 'blue'; return <div key={`${a.indicator}-${i}`} className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-0 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.status === 'Critical' ? 'bg-red-50 text-red-600' : a.status === 'Needs attention' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}><AlertTriangle size={17} /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold text-[#222]">{a.indicator}</p><Badge color={actionColor}>{a.status}</Badge></div><p className="mt-1 text-[13px] text-[#555]">{a.title}</p><p className="mt-1 text-[11px] text-[#888]">{a.reason} · Weight {a.weight}% · {a.current_value === null || a.current_value === undefined ? `Completing this unlocks ${a.weight}% of score evidence` : `Potential improvement toward healthy level: ${a.potential_impact} points`}</p></div></div>
      <button onClick={() => navigate(a.path)} className="shrink-0 self-start rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-[12px] font-semibold text-[#4F46E5] md:self-center">Take action</button>
    </div>; }) : <Empty>All recorded academic indicators are at or above the healthy benchmark.</Empty>}</Card>
  </Layout>;
};

export const StudentHealthSignals = () => {
  const navigate = useNavigate();
  const [structure, setStructure] = useState({ classes: [] });
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const loadSetup = useCallback(async () => {
    const [setup, studentResponse] = await Promise.all([api.get('/academic-structure'), api.get('/students')]);
    setStructure(setup.data || { classes: [] }); setStudents(studentResponse.data || []);
  }, []);
  useEffect(() => { loadSetup().catch(() => setNotice('Could not load the configured classes and students.')); }, [loadSetup]);
  const chosenClass = (structure.classes || []).find((item) => item.name === className);
  const sections = chosenClass?.sections || [];
  const loadDashboard = useCallback(async () => {
    if (!className || !section) { setData(null); return; }
    setLoading(true); setNotice('');
    try { setData((await api.get('/student-health-dashboard', { params: { class_name: className, section } })).data); }
    catch (_) { setNotice('Could not load health data for this class and section.'); }
    finally { setLoading(false); }
  }, [className, section]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  const fmt = (value) => value === null || value === undefined ? '—' : `${value}%`;
  const successProfiles = (data?.students || []).map((student) => {
    const metrics = [
      { key: 'Learning', value: student.latest_score, weight: 45 },
      { key: 'Attendance', value: student.attendance_percent, weight: 35 },
      { key: 'Participation', value: student.participation_percent, weight: 20 },
    ].filter((metric) => metric.value !== null && metric.value !== undefined);
    const availableWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
    const healthScore = availableWeight ? Math.round(metrics.reduce((sum, metric) => sum + metric.value * metric.weight, 0) / availableWeight) : null;
    const weakest = metrics.length ? [...metrics].sort((a, b) => a.value - b.value)[0] : null;
    const level = healthScore === null ? 'Awaiting data' : healthScore < 50 ? 'Urgent' : healthScore < 70 ? 'Needs support' : healthScore < 80 ? 'Watch' : 'On track';
    const nextAction = !weakest ? 'Complete attendance, marks and participation records' : weakest.key === 'Attendance' ? 'Contact family and agree an attendance recovery step' : weakest.key === 'Learning' ? 'Plan a focused remedial session for the weakest subject' : 'Use a classroom check-in and participation task';
    const parentGuidance = !weakest ? 'Share an update after the school records sufficient evidence.' : `${student.student_name} needs support with ${weakest.key.toLowerCase()} (${weakest.value}%). Share one positive observation, this concern and the next school action.`;
    return { ...student, healthScore, level, weakest, nextAction, parentGuidance, evidenceCount: metrics.length };
  });
  const studentsRequiringAttention = successProfiles.filter((student) => ['Urgent', 'Needs support', 'Watch'].includes(student.level)).sort((a, b) => a.healthScore - b.healthScore);
  const scoredProfiles = successProfiles.filter((student) => student.healthScore !== null);
  const classHealth = scoredProfiles.length ? Math.round(scoredProfiles.reduce((sum, student) => sum + student.healthScore, 0) / scoredProfiles.length) : null;
  const dataCoverage = successProfiles.length ? Math.round(successProfiles.reduce((sum, student) => sum + student.evidenceCount, 0) / (successProfiles.length * 3) * 100) : 0;
  const improvingCount = successProfiles.filter((student) => student.trend_status === 'Improved').length;
  const barrierCounts = successProfiles.reduce((counts, student) => { if (student.weakest) counts[student.weakest.key] = (counts[student.weakest.key] || 0) + 1; return counts; }, {});
  const primaryBarrier = Object.entries(barrierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Awaiting evidence';
  return <Layout>
    <PageTitle title="Student Success Center" subtitle="Turn attendance, assessment progress and classroom participation into early support for every child." actions={<Btn variant="outline" onClick={loadDashboard}>Refresh</Btn>} />
    {notice && <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">{notice}</div>}
    <Card title="Choose the teaching group" subtitle="This dashboard never combines different classes or sections."><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><label className="text-[12px] font-medium text-[#555]">Class<Select value={className} onChange={(e) => { setClassName(e.target.value); setSection(''); }}><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</Select></label><label className="text-[12px] font-medium text-[#555]">Section<Select value={section} onChange={(e) => setSection(e.target.value)}><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</Select></label><div className="self-end text-[12px] text-[#777]">{className && section ? `${className} • ${section}` : 'Choose both filters to see the dashboard.'}</div></div></Card>
    {!className || !section ? <Card className="mt-5" title="Student Success Center"><Empty>Select the exact Class and Section above to open the school-owner brief, teacher action queue and parent partnership guidance.</Empty></Card> : <>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[{ label: 'Class Success Index', value: classHealth === null ? 'Awaiting data' : `${classHealth}/100`, icon: HeartPulse, tint: 'bg-indigo-50 text-[#4F46E5]' }, { label: 'Urgent Support', value: successProfiles.filter((student) => student.level === 'Urgent').length, icon: AlertTriangle, tint: 'bg-red-50 text-red-600' }, { label: 'Students Improving', value: improvingCount, icon: Activity, tint: 'bg-green-50 text-green-600' }, { label: 'Evidence Coverage', value: `${dataCoverage}%`, icon: Users, tint: 'bg-blue-50 text-blue-600' }].map(({ label, value, icon: Icon, tint }) => <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon size={21} /></span><p className="mt-4 font-poppins text-[24px] font-bold text-[#1a1a1a]">{loading ? '…' : value}</p><p className="text-[13px] text-[#888]">{label}</p></div>)}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="School owner brief" subtitle="What requires management attention now."><p className="text-[12px] uppercase tracking-wide text-[#888]">Primary class barrier</p><p className="mt-2 text-[20px] font-bold text-[#222]">{primaryBarrier}</p><p className="mt-2 text-[13px] leading-5 text-[#666]">{studentsRequiringAttention.length} student(s) need a planned response. Review whether staffing, timetable or parent follow-up is blocking improvement.</p></Card>
        <Card title="Teacher agenda" subtitle="The next actions, not another report."><p className="text-[20px] font-bold text-[#222]">{studentsRequiringAttention.length ? `${Math.min(studentsRequiringAttention.length, 5)} priority check-ins` : 'No urgent check-ins'}</p><p className="mt-2 text-[13px] leading-5 text-[#666]">Start with {studentsRequiringAttention[0]?.student_name || 'students who need support'} and record a small, measurable action before the next assessment.</p></Card>
        <Card title="Parent partnership" subtitle="Clear and respectful communication."><p className="text-[20px] font-bold text-[#222]">{studentsRequiringAttention.length} update(s) to prepare</p><p className="mt-2 text-[13px] leading-5 text-[#666]">Each update should include one strength, one evidence-based concern, the school action and one simple step for home.</p></Card>
      </div>
      <Card title="School owner: subject opportunity map" subtitle="Use the latest assessment to decide where coaching, revision time or teaching support should be concentrated." className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Subject' }, { label: 'Latest assessment' }, { label: 'Class average' }, { label: 'Management signal' }]}>{(data?.subject_scores || []).map((item) => <tr key={item.subject} className="border-b border-gray-50"><td className="px-6 py-3 text-[13px] font-medium">{item.subject}</td><td className="py-3 text-[13px] text-[#666]">{item.assessment}</td><td className="py-3 text-[13px] font-medium">{fmt(item.average)}</td><td className="py-3 pr-6"><div className="flex items-center gap-3"><div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${item.average >= 75 ? 'bg-green-500' : item.average >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${item.average || 0}%` }} /></div><span className="text-[11px] text-[#777]">{item.average >= 75 ? 'Protect momentum' : item.average >= 50 ? 'Targeted revision' : 'Teaching support required'}</span></div></td></tr>)}</Table>{!loading && !(data?.subject_scores || []).length && <Empty>No exam results have been entered for {className} {section} yet.</Empty>}</div></Card>
      <Card title="Teacher action queue" subtitle="Students are ranked automatically; the weakest signal determines the suggested first action." className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Student' }, { label: 'Success index' }, { label: 'Priority' }, { label: 'Why this matters' }, { label: 'Recommended next action' }, { label: 'Support plan' }]}>{studentsRequiringAttention.map((student) => <tr key={`risk-${student.student_id}`} className="border-b border-gray-50"><td className="px-6 py-3"><p className="text-[13px] font-medium">{student.student_name}</p><p className="text-[11px] text-[#888]">Roll {student.roll || '—'}</p></td><td className="py-3 text-[13px] font-semibold">{student.healthScore}/100</td><td className="py-3"><Badge color={student.level === 'Urgent' ? 'red' : student.level === 'Needs support' ? 'amber' : 'blue'}>{student.level}</Badge></td><td className="py-3 text-[12px] text-[#666]">{student.weakest?.key} {student.weakest ? `${student.weakest.value}%` : ''}</td><td className="max-w-[280px] py-3 text-[12px] leading-5 text-[#555]">{student.nextAction}</td><td className="py-3 pr-6"><button onClick={() => navigate(`/academics/interventions?class_name=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&student_id=${encodeURIComponent(student.student_id)}&student_name=${encodeURIComponent(student.student_name)}&priority=${encodeURIComponent(student.level)}&signal=${encodeURIComponent(student.weakest?.key || '')}&signal_value=${encodeURIComponent(student.weakest?.value ?? '')}&action=${encodeURIComponent(student.nextAction)}`)} className="text-[12px] font-medium text-[#4F46E5]">Create plan</button></td></tr>)}</Table>{!loading && !studentsRequiringAttention.length && <Empty>No students in this class and section currently require academic attention.</Empty>}</div></Card>
      <Card title="Parent-ready guidance" subtitle="A communication starting point for the school; it avoids labels and explains evidence plus the next step." className="mt-5">{studentsRequiringAttention.slice(0, 5).map((student) => <div key={`parent-${student.student_id}`} className="border-b border-gray-100 py-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] font-semibold text-[#222]">{student.student_name}</p><Badge color={student.level === 'Urgent' ? 'red' : 'amber'}>{student.level}</Badge></div><p className="mt-2 text-[12px] leading-5 text-[#666]">{student.parentGuidance}</p></div>)}{!studentsRequiringAttention.length && <Empty>No parent support communication is currently required.</Empty>}</Card>
      <Card title="All-student success register" subtitle="A concise monitoring register for the selected class and section." className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Student' }, { label: 'Success index' }, { label: 'Attendance' }, { label: 'Participation' }, { label: 'Exam progress' }, { label: 'Current status' }]}>{successProfiles.map((student) => { const trendColor = student.trend_status === 'Improved' ? 'green' : student.trend_status === 'Declined' ? 'red' : student.trend_status === 'Stable' ? 'blue' : 'gray'; return <tr key={student.student_id} className="border-b border-gray-50"><td className="px-6 py-3 text-[13px] font-medium">{student.student_name}</td><td className="py-3 text-[13px] font-semibold">{student.healthScore === null ? '—' : `${student.healthScore}/100`}</td><td className="py-3 text-[13px]">{fmt(student.attendance_percent)}</td><td className="py-3 text-[13px]">{fmt(student.participation_percent)}</td><td className="py-3"><Badge color={trendColor}>{student.trend_status}</Badge></td><td className="py-3 pr-6"><Badge color={student.level === 'Urgent' ? 'red' : student.level === 'Needs support' ? 'amber' : student.level === 'Watch' ? 'blue' : student.level === 'On track' ? 'green' : 'gray'}>{student.level}</Badge></td></tr>; })}</Table>{!loading && !successProfiles.length && <Empty>No students are enrolled in {className} {section}.</Empty>}</div></Card>
    </>}
  </Layout>;
};

export const CurriculumSyllabus = () => {
  const [units, setUnits] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [structure, setStructure] = useState({ academic_year: '', classes: [] });
  const [form, setForm] = useState({ class_name: '', section: '', subject: '', teacher_id: '', teacher_name: '', term: '', unit_name: '', chapter: '', learning_outcomes: '', periods_planned: '', teaching_resources: '', assessment_method: '', priority: 'Normal', start_date: '', target_date: '' });
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [unitResponse, structureResponse, teachingResponse] = await Promise.all([api.get('/curriculum-units'), api.get('/academic-structure'), api.get('/teaching/setup')]);
    setUnits(unitResponse.data);
    setStructure(structureResponse.data || { academic_year: '', classes: [] });
    setAllocations(teachingResponse.data?.allocations || []);
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => { setNotice('Could not load the academic setup. Please refresh and try again.'); setLoading(false); }); }, [load]);

  const selectedClass = (structure.classes || []).find((item) => item.name === form.class_name);
  const sections = selectedClass?.sections || [];
  const selectedSection = sections.find((item) => item.name === form.section);
  const subjects = selectedSection?.subjects || [];
  const eligibleTeachers = allocations.filter((item) => item.class_name === form.class_name && item.section === form.section && item.subject === form.subject);

  const updateClass = (className) => setForm({ ...form, class_name: className, section: '', subject: '', teacher_id: '', teacher_name: '' });
  const updateSection = (section) => setForm({ ...form, section, subject: '', teacher_id: '', teacher_name: '' });

  const save = async () => {
    setNotice('');
    try {
      await api.post('/curriculum-units', form);
      setNotice('Chapter plan saved. The assigned teacher can now complete it, and overdue plans will be escalated automatically.');
      setForm({ ...form, unit_name: '', chapter: '', learning_outcomes: '', periods_planned: '', teaching_resources: '', assessment_method: '', priority: 'Normal', start_date: '', target_date: '' });
      await load();
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Could not save the chapter plan. Please complete every field.');
    }
  };

  const complete = async (unit) => {
    try {
      await api.post(`/curriculum-units/${unit.id}/complete`);
      setNotice(`${unit.chapter} has been marked completed.`);
      await load();
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Could not mark this chapter complete.');
    }
  };

  const statusColor = (status) => status === 'Completed' ? 'green' : status === 'Overdue' ? 'red' : status === 'In progress' ? 'blue' : 'amber';
  const completedCount = units.filter((unit) => unit.status === 'Completed').length;
  const overdueCount = units.filter((unit) => unit.status === 'Overdue').length;
  const onTrackCount = units.filter((unit) => unit.status !== 'Completed' && unit.status !== 'Overdue').length;

  return <Layout>
    <PageTitle title="Curriculum & Syllabus" subtitle="Plan every chapter for the exact class, section and subject, then track completion against its teaching deadline." actions={<Btn icon={Plus} onClick={save}>Plan chapter</Btn>} />
    {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('saved') || notice.includes('marked') ? 'border-green-100 bg-green-50 text-green-700' : 'border-indigo-100 bg-indigo-50 text-[#4F46E5]'}`}>{notice}</div>}
    {!loading && !(structure.classes || []).length && <Card className="mb-5" title="Academic Setup needed"><p className="text-[13px] text-[#666]">First create the Academic Year, classes, sections and their subjects in <strong>Academic Setup</strong>. Those exact choices will then appear here.</p></Card>}
    <StatCards items={[{ label: 'Chapters Planned', value: units.length, icon: BookOpenCheck, tint: 'bg-indigo-50 text-[#4F46E5]' }, { label: 'On Track', value: onTrackCount, icon: CalendarClock, tint: 'bg-blue-50 text-blue-600' }, { label: 'Completed', value: completedCount, icon: CheckCircle2, tint: 'bg-green-50 text-green-600' }, { label: 'Overdue', value: overdueCount, icon: AlertTriangle, tint: 'bg-red-50 text-red-600' }]} />
    <Card title="Curriculum planning workspace" subtitle="Build a teaching-ready plan with learning outcomes, required periods, resources and assessment evidence.">
      <div className="space-y-5">
        <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"><div className="mb-3"><p className="text-[13px] font-semibold text-[#222]">1. Academic context</p><p className="text-[11px] text-[#888]">Choose the exact teaching group, assigned teacher, unit and term.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-[12px] font-medium text-[#555]">Class<Select value={form.class_name} onChange={(e) => updateClass(e.target.value)}><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</Select></label>
          <label className="text-[12px] font-medium text-[#555]">Section<Select value={form.section} onChange={(e) => updateSection(e.target.value)}><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</Select></label>
          <label className="text-[12px] font-medium text-[#555]">Subject<Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, teacher_id: '', teacher_name: '' })}><option value="">Select subject</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</Select></label>
          <label className="text-[12px] font-medium text-[#555]">Teacher<Select value={form.teacher_id} onChange={(e) => { const teacher = eligibleTeachers.find((item) => item.teacher_id === e.target.value); setForm({ ...form, teacher_id: e.target.value, teacher_name: teacher?.teacher_name || '' }); }}><option value="">Select assigned teacher</option>{eligibleTeachers.map((teacher) => <option key={teacher.teacher_id} value={teacher.teacher_id}>{teacher.teacher_name}</option>)}</Select></label>
          <label className="text-[12px] font-medium text-[#555]">Unit<input value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} placeholder="e.g. Number sense" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
          <label className="text-[12px] font-medium text-[#555]">Term<Select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}><option value="">Select term</option>{['Term 1', 'Term 2', 'Term 3', 'Annual'].map((term) => <option key={term}>{term}</option>)}</Select></label>
        </div></section>
        <section className="rounded-xl border border-gray-100 p-4"><div className="mb-3"><p className="text-[13px] font-semibold text-[#222]">2. Chapter and learning plan</p><p className="text-[11px] text-[#888]">Define what must be taught and what students should be able to demonstrate.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-[12px] font-medium text-[#555] md:col-span-3">Chapter<input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="e.g. Addition within 100" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
          <label className="text-[12px] font-medium text-[#555]">Periods planned<input type="number" min="1" value={form.periods_planned} onChange={(e) => setForm({ ...form, periods_planned: e.target.value })} placeholder="e.g. 6" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
          <label className="text-[12px] font-medium text-[#555] md:col-span-3">Learning outcomes<textarea value={form.learning_outcomes} onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })} placeholder="What should students know or be able to do after this chapter?" className="mt-1 min-h-[84px] w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px]" /></label>
          <label className="text-[12px] font-medium text-[#555]">Priority<Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{['Normal', 'High', 'Foundation'].map((priority) => <option key={priority}>{priority}</option>)}</Select></label>
        </div></section>
        <section className="rounded-xl border border-gray-100 p-4"><div className="mb-3"><p className="text-[13px] font-semibold text-[#222]">3. Delivery and evidence</p><p className="text-[11px] text-[#888]">Plan the resources, assessment and timeline the school will monitor.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-[12px] font-medium text-[#555]">Teaching resources<input value={form.teaching_resources} onChange={(e) => setForm({ ...form, teaching_resources: e.target.value })} placeholder="Textbook, worksheet, lab kit" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
          <label className="text-[12px] font-medium text-[#555]">Assessment method<Select value={form.assessment_method} onChange={(e) => setForm({ ...form, assessment_method: e.target.value })}><option value="">Select method</option>{['Worksheet', 'Oral assessment', 'Class activity', 'Quiz', 'Project', 'Unit test'].map((method) => <option key={method}>{method}</option>)}</Select></label>
          <label className="text-[12px] font-medium text-[#555]">Start date<input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
          <label className="text-[12px] font-medium text-[#555]">Completion deadline<input type="date" value={form.target_date} min={form.start_date || undefined} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
        </div><p className="mt-3 text-[11px] text-[#888]">The assigned subject teacher is linked automatically from Teacher Allocation.</p></section>
      </div>
    </Card>
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card title="2. Completion and accountability" subtitle="The coordinator can record completion here. The teacher app can use the same action later."><div className="flex gap-3 text-[13px] text-[#666]"><CheckCircle2 className="mt-0.5 shrink-0 text-green-600" size={18} />A completed chapter is recorded with the completion time and no longer appears as behind schedule.</div></Card>
      <Card title="Automatic timeline alerts" subtitle="No manual percentage slider is required."><div className="flex gap-3 text-[13px] text-[#666]"><CalendarClock className="mt-0.5 shrink-0 text-amber-600" size={18} />If a chapter is not completed after its deadline, it becomes <strong>Overdue</strong> and an alert is created for the Principal, Director and Admin.</div></Card>
    </div>
    <Card title="Chapter delivery register" subtitle="A school-owner view of teaching scope, ownership, planned effort and deadline risk." className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Class / Section' }, { label: 'Subject / Term' }, { label: 'Unit & Chapter' }, { label: 'Teacher' }, { label: 'Periods' }, { label: 'Timeline' }, { label: 'Status' }, { label: 'Action' }]}>{units.map((u) => <tr key={u.id} className="border-b border-gray-50"><td className="px-6 py-3 text-[13px] font-medium">{u.class_name} / {u.section}</td><td className="py-3"><p className="text-[13px]">{u.subject}</p><p className="text-[11px] text-[#888]">{u.term || 'Term not set'}</p></td><td className="py-3"><p className="text-[13px] font-medium">{u.chapter}</p><p className="max-w-[240px] truncate text-[11px] text-[#888]">{u.unit_name || u.learning_outcomes || 'Learning outcome not added'}</p></td><td className="py-3 text-[12px] text-[#555]">{u.teacher_name || 'Unassigned'}</td><td className="py-3 text-[12px] text-[#555]">{u.periods_planned || '—'}</td><td className="py-3 text-[12px] text-[#666]">{u.start_date} → {u.target_date}</td><td className="py-3"><Badge color={statusColor(u.status)}>{u.status || 'Planned'}</Badge></td><td className="py-3 pr-6">{u.status !== 'Completed' && <button onClick={() => complete(u)} className="text-[12px] font-medium text-[#4F46E5]">Mark complete</button>}</td></tr>)}</Table>{!loading && !units.length && <Empty>No chapter plans yet. Choose a class, section and subject above to create the first plan.</Empty>}</div></Card>
  </Layout>;
};

const ClassroomObservationWorkspace = () => {
  const blank = { class_name: '', section: '', subject: '', teacher_id: '', teacher_name: '', unit_name: '', observation_date: new Date().toISOString().slice(0, 10), plan_score: '', behaviour_score: '', engagement_score: '', notes: '', academic_year: '' };
  const [structure, setStructure] = useState({ academic_year: '', classes: [] });
  const [allocations, setAllocations] = useState([]);
  const [observations, setObservations] = useState([]);
  const [form, setForm] = useState(blank);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const [setup, allocationResponse, observationResponse] = await Promise.all([api.get('/academic-structure'), api.get('/teaching/setup'), api.get('/classroom-observations')]);
    setStructure(setup.data || { academic_year: '', classes: [] });
    setAllocations(allocationResponse.data.allocations || []);
    setObservations(observationResponse.data || []);
  }, []);
  useEffect(() => { load().catch(() => setNotice('Could not load academic setup, teacher allocations or observation records.')); }, [load]);
  const selectedClass = (structure.classes || []).find((item) => item.name === form.class_name);
  const sections = selectedClass?.sections || [];
  const selectedSection = sections.find((item) => item.name === form.section);
  const subjects = selectedSection?.subjects || [];
  const eligibleTeachers = allocations.filter((item) => item.class_name === form.class_name && item.section === form.section && item.subject === form.subject);
  const chooseTeacher = (teacherId) => { const allocation = eligibleTeachers.find((item) => item.teacher_id === teacherId); setForm({ ...form, teacher_id: teacherId, teacher_name: allocation?.teacher_name || '' }); };
  const save = async () => {
    setNotice('');
    if (Object.entries(form).filter(([key]) => ['class_name', 'section', 'subject', 'teacher_id', 'unit_name', 'observation_date', 'plan_score', 'behaviour_score', 'engagement_score'].includes(key)).some(([, value]) => value === '')) { setNotice('Complete the class, section, subject, allocated teacher, observation date, lesson/chapter and all three ratings.'); return; }
    setSaving(true);
    try { await api.post('/classroom-observations', { ...form, plan_score: Number(form.plan_score), behaviour_score: Number(form.behaviour_score), engagement_score: Number(form.engagement_score), academic_year: structure.academic_year }); setNotice('Classroom observation saved. It will feed into Teacher Performance for Principal review.'); setForm({ ...blank, academic_year: structure.academic_year }); await load(); }
    catch (error) { setNotice(error.response?.data?.detail || 'Could not save the observation.'); }
    finally { setSaving(false); }
  };
  const total = [form.plan_score, form.behaviour_score, form.engagement_score].reduce((sum, value) => sum + (Number(value) || 0), 0);
  const visibleObservations = observations.filter((item) => !form.class_name || (item.class_name === form.class_name && (!form.section || item.section === form.section)));
  const rating = (key, label, help) => <label key={key} className="rounded-xl bg-[#fafafa] p-4"><span className="text-[13px] font-medium text-[#333]">{label}</span><span className="mt-1 block text-[11px] text-[#888]">{help}</span><Select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}><option value="">Rating out of 5</option>{[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number} / 5</option>)}</Select></label>;
  return <>
    <PageTitle title="Classroom Observation Evidence" subtitle="Academic Coordinator evidence for teaching practice and student involvement." actions={<Btn icon={Plus} onClick={save}>{saving ? 'Saving…' : 'Save observation'}</Btn>} />
    {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('saved') ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{notice}</div>}
    <Card title="Physical classroom observation" subtitle="Choose the exact class, section and subject before selecting its allocated teacher."><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="text-[12px] font-medium text-[#555]">Class<Select value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value, section: '', subject: '', teacher_id: '', teacher_name: '' })}><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</Select></label><label className="text-[12px] font-medium text-[#555]">Section<Select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value, subject: '', teacher_id: '', teacher_name: '' })}><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</Select></label><label className="text-[12px] font-medium text-[#555]">Subject<Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, teacher_id: '', teacher_name: '' })}><option value="">Select subject</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label><label className="text-[12px] font-medium text-[#555]">Allocated teacher<Select value={form.teacher_id} onChange={(e) => chooseTeacher(e.target.value)}><option value="">Select allocated teacher</option>{eligibleTeachers.map((item) => <option key={item.id} value={item.teacher_id}>{item.teacher_name}</option>)}</Select></label><label className="text-[12px] font-medium text-[#555]">Observation date<input type="date" value={form.observation_date} onChange={(e) => setForm({ ...form, observation_date: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label><label className="text-[12px] font-medium text-[#555] xl:col-span-2">Lesson / chapter observed<input value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} placeholder="e.g. Fractions — equivalent fractions" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label><label className="text-[12px] font-medium text-[#555]">Observation notes (optional)<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Key evidence noticed" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label></div>{form.class_name && form.section && form.subject && !eligibleTeachers.length && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">No teacher is allocated for this Class, Section and Subject. Create the allocation first in Teaching Excellence → Setup & Teacher Allocations.</p>}</Card>
    <Card title="Rate the observed lesson" subtitle="Each score is out of 5 and is saved against this specific subject teacher, class and section." className="mt-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{rating('plan_score', 'Teaching & subject delivery', 'Clarity, planning and subject understanding')}{rating('engagement_score', 'Student active involvement', 'Questioning, participation and activity involvement')}{rating('behaviour_score', 'Classroom management', 'Learning environment, behaviour and time use')}</div><p className="mt-4 text-right text-[13px] font-semibold text-[#444]">Observation score: <span className="text-[#4F46E5]">{total}/15</span></p></Card>
    <Card title="Observation records" subtitle="These observations will later feed the Principal’s Teacher Performance view." className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Teacher' }, { label: 'Class / Section / Subject' }, { label: 'Lesson' }, { label: 'Date' }, { label: 'Delivery' }, { label: 'Student involvement' }, { label: 'Management' }, { label: 'Total' }]}>{visibleObservations.map((item) => <tr key={item.id} className="border-b border-gray-50"><td className="px-6 py-3 text-[13px] font-medium">{item.teacher_name}</td><td className="py-3 text-[12px] text-[#666]">{item.class_name} · {item.section} · {item.subject}</td><td className="py-3 text-[13px] text-[#666]">{item.unit_name}</td><td className="py-3 text-[13px] text-[#666]">{item.observation_date}</td><td className="py-3 text-[13px]">{item.plan_score}/5</td><td className="py-3 text-[13px]">{item.engagement_score}/5</td><td className="py-3 text-[13px]">{item.behaviour_score}/5</td><td className="py-3 pr-6"><Badge color={(item.total_score || 0) >= 12 ? 'green' : 'amber'}>{item.total_score || 0}/15</Badge></td></tr>)}</Table>{!visibleObservations.length && <Empty>No physical classroom observations recorded for this selection yet.</Empty>}</div></Card>
  </>;
};

export const AcademicInterventions = () => {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState(searchParams.get('student_id') ? 'plans' : 'plans');
  const reviewDate = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const emptyPlan = {
    class_name: searchParams.get('class_name') || '', section: searchParams.get('section') || '',
    student_id: searchParams.get('student_id') || '', student_name: searchParams.get('student_name') || '',
    priority: searchParams.get('priority') || 'Needs support', signal: searchParams.get('signal') || '',
    signal_value: searchParams.get('signal_value') || '', recommended_action: searchParams.get('action') || '',
    goal: '', owner: 'Academic Coordinator', deadline: reviewDate, parent_action: '', review_notes: '', status: 'Open',
  };
  const [structure, setStructure] = useState({ classes: [] });
  const [students, setStudents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState(emptyPlan);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const [setup, studentResponse, planResponse] = await Promise.all([api.get('/academic-structure'), api.get('/students'), api.get('/interventions')]);
    setStructure(setup.data || { classes: [] }); setStudents(studentResponse.data || []); setPlans(planResponse.data || []);
  }, []);
  useEffect(() => { load().catch(() => setNotice('Could not load student support plans.')); }, [load]);
  const selectedClass = (structure.classes || []).find((item) => item.name === plan.class_name);
  const sections = selectedClass?.sections || [];
  const eligibleStudents = students.filter((student) => student.class_name === plan.class_name && student.section === plan.section).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const chooseStudent = (studentId) => { const student = eligibleStudents.find((item) => item.id === studentId); setPlan({ ...plan, student_id: studentId, student_name: student?.name || '' }); };
  const savePlan = async () => {
    setNotice('');
    if (!plan.class_name || !plan.section || !plan.student_id || !plan.signal || !plan.recommended_action || !plan.goal || !plan.owner || !plan.deadline) { setNotice('Choose the student and complete the concern, action, measurable goal, owner and review date.'); return; }
    setSaving(true);
    try {
      await api.post('/interventions', { ...plan, concern: `${plan.signal}${plan.signal_value ? ` ${plan.signal_value}%` : ''} · ${plan.priority}`, source: 'Student Success Center', academic_year: structure.academic_year });
      setNotice('Student support plan created and linked to Student Success Center.');
      setPlan({ ...emptyPlan, class_name: plan.class_name, section: plan.section, student_id: '', student_name: '', signal: '', signal_value: '', recommended_action: '', goal: '', parent_action: '', review_notes: '' });
      await load();
    } catch (error) { setNotice(error.response?.data?.detail || 'Could not create the support plan.'); }
    finally { setSaving(false); }
  };
  const changeStatus = async (item, status) => {
    const outcome = status === 'Completed' ? window.prompt('Record the result seen after this support plan. This becomes the evidence for closing it:') : '';
    if (status === 'Completed' && !outcome?.trim()) return;
    try { await api.put(`/interventions/${item.id}`, { status, outcome: outcome?.trim() }); setNotice(status === 'Completed' ? 'Plan completed. Its outcome now contributes to intervention resolution.' : 'Plan status updated.'); await load(); }
    catch (_) { setNotice('Could not update the plan status.'); }
  };
  const openPlans = plans.filter((item) => item.status !== 'Completed');
  const overduePlans = openPlans.filter((item) => item.deadline && item.deadline < new Date().toISOString().slice(0, 10));
  const completedPlans = plans.filter((item) => item.status === 'Completed');
  const priorityColor = (value) => value === 'Urgent' || value === 'High' ? 'red' : value === 'Watch' ? 'blue' : 'amber';

  return <Layout>
    <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
      <button onClick={() => setView('plans')} className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold ${view === 'plans' ? 'bg-[#4F46E5] text-white' : 'text-[#666]'}`}>Student support plans</button>
      <button onClick={() => setView('observations')} className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold ${view === 'observations' ? 'bg-[#4F46E5] text-white' : 'text-[#666]'}`}>Classroom observation evidence</button>
    </div>
    {view === 'observations' ? <ClassroomObservationWorkspace /> : <>
      <PageTitle title="Academic Intervention Hub" subtitle="Convert a student health signal into an owned action, review it and record the outcome." actions={<Btn icon={Plus} onClick={savePlan}>{saving ? 'Saving…' : 'Create support plan'}</Btn>} />
      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('created') || notice.includes('completed') || notice.includes('updated') ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{notice}</div>}
      <StatCards items={[{ label: 'Active support plans', value: openPlans.length, icon: ClipboardPlus, tint: 'bg-indigo-50 text-[#4F46E5]' }, { label: 'Reviews overdue', value: overduePlans.length, icon: CalendarClock, tint: 'bg-red-50 text-red-600' }, { label: 'Resolved plans', value: completedPlans.length, icon: CheckCircle2, tint: 'bg-green-50 text-green-600' }, { label: 'Parent actions agreed', value: plans.filter((item) => item.parent_action).length, icon: Users, tint: 'bg-blue-50 text-blue-600' }]} />
      <Card title="1. Student and evidence" subtitle="Start from Student Success Center or choose the exact student here."><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-[12px] font-medium text-[#555]">Class<Select value={plan.class_name} onChange={(e) => setPlan({ ...plan, class_name: e.target.value, section: '', student_id: '', student_name: '' })}><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-[#555]">Section<Select value={plan.section} onChange={(e) => setPlan({ ...plan, section: e.target.value, student_id: '', student_name: '' })}><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-[#555]">Student<Select value={plan.student_id} onChange={(e) => chooseStudent(e.target.value)}><option value="">Select student</option>{eligibleStudents.map((student) => <option key={student.id} value={student.id}>{student.name} {student.roll ? `· Roll ${student.roll}` : ''}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-[#555]">Priority<Select value={plan.priority} onChange={(e) => setPlan({ ...plan, priority: e.target.value })}>{['Urgent', 'Needs support', 'Watch'].map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-[#555]">Primary health signal<Select value={plan.signal} onChange={(e) => setPlan({ ...plan, signal: e.target.value })}><option value="">Select signal</option>{['Learning', 'Attendance', 'Participation', 'Homework', 'Wellbeing / other'].map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-[#555]">Current evidence (%)<input type="number" min="0" max="100" value={plan.signal_value} onChange={(e) => setPlan({ ...plan, signal_value: e.target.value })} placeholder="Optional" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
        <div className="rounded-xl bg-indigo-50 p-4 xl:col-span-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Signal snapshot</p><p className="mt-2 text-[13px] font-semibold text-[#222]">{plan.student_name || 'Select a student'}</p><p className="mt-1 text-[12px] text-[#666]">{plan.signal ? `${plan.signal}${plan.signal_value ? ` is ${plan.signal_value}%` : ''}` : 'The concern selected here remains linked to the support plan.'}</p></div>
      </div></Card>
      <Card title="2. Agree the support plan" subtitle="Every plan needs one action, one measurable goal, one owner and one review date." className="mt-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-[12px] font-medium text-[#555]">School action<textarea value={plan.recommended_action} onChange={(e) => setPlan({ ...plan, recommended_action: e.target.value })} placeholder="What will the teacher or coordinator do?" className="mt-1 min-h-[92px] w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px]" /></label>
        <label className="text-[12px] font-medium text-[#555]">Measurable goal<textarea value={plan.goal} onChange={(e) => setPlan({ ...plan, goal: e.target.value })} placeholder="e.g. Improve Mathematics accuracy to 70% in the next assessment" className="mt-1 min-h-[92px] w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px]" /></label>
        <label className="text-[12px] font-medium text-[#555]">Plan owner<Select value={plan.owner} onChange={(e) => setPlan({ ...plan, owner: e.target.value })}>{['Academic Coordinator', 'Class Teacher', 'Subject Teacher', 'School Counsellor', 'Principal'].map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-[12px] font-medium text-[#555]">Review date<input type="date" value={plan.deadline} onChange={(e) => setPlan({ ...plan, deadline: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
        <label className="text-[12px] font-medium text-[#555]">Parent partnership step (optional)<input value={plan.parent_action} onChange={(e) => setPlan({ ...plan, parent_action: e.target.value })} placeholder="One simple action agreed with the family" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
        <label className="text-[12px] font-medium text-[#555]">Baseline / review note (optional)<input value={plan.review_notes} onChange={(e) => setPlan({ ...plan, review_notes: e.target.value })} placeholder="Strength, context or evidence to review" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label>
      </div></Card>
      <Card title="Active intervention review queue" subtitle="Review overdue plans first; close a plan only after recording or confirming the outcome." className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Student' }, { label: 'Signal' }, { label: 'Action & goal' }, { label: 'Owner' }, { label: 'Review' }, { label: 'Status / outcome' }]}>{plans.slice().sort((a, b) => (a.status === 'Completed') - (b.status === 'Completed') || String(a.deadline || '').localeCompare(String(b.deadline || ''))).map((item) => { const overdue = item.status !== 'Completed' && item.deadline && item.deadline < new Date().toISOString().slice(0, 10); return <tr key={item.id} className="border-b border-gray-50"><td className="px-6 py-3"><p className="text-[13px] font-semibold">{item.student_name}</p><p className="text-[11px] text-[#888]">{item.class_name}{item.section ? ` · ${item.section}` : ''}</p></td><td className="py-3"><Badge color={priorityColor(item.priority || item.severity)}>{item.signal || item.concern || 'Academic risk'}</Badge></td><td className="max-w-[330px] py-3"><p className="text-[12px] text-[#444]">{item.recommended_action}</p><p className="mt-1 text-[11px] text-[#888]">Goal: {item.goal || 'Add a measurable goal during review'}</p></td><td className="py-3 text-[12px] text-[#555]">{item.owner || 'Unassigned'}</td><td className="py-3"><p className={`text-[12px] font-medium ${overdue ? 'text-red-600' : 'text-[#555]'}`}>{item.deadline || '—'}</p>{overdue && <span className="text-[10px] text-red-500">Overdue</span>}</td><td className="py-3 pr-6">{item.status === 'Completed' ? <Badge color="green">Resolved</Badge> : <div className="flex flex-col items-start gap-1"><Badge color={overdue ? 'red' : 'blue'}>{item.status || 'Open'}</Badge><button onClick={() => changeStatus(item, 'Completed')} className="text-[11px] font-semibold text-[#4F46E5]">Record successful outcome</button></div>}</td></tr>; })}</Table>{!plans.length && <Empty>No support plans yet. Open Student Success Center, select a class and section, then create a plan for a student who needs support.</Empty>}</div></Card>
    </>}
  </Layout>;
};
