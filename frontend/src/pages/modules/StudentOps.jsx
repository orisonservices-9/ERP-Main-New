import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, Card, Btn, Badge, Table } from '../../components/Shared';
import { ArrowRightLeft, GraduationCap, Check, Loader2, AlertTriangle, KeyRound, ShieldCheck, X } from 'lucide-react';
import api from '../../api';

const Person = ({ student }) => <div className="flex items-center gap-3">{student.avatar ? <img src={student.avatar} alt="" className="w-8 h-8 rounded-full object-cover"/> : <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[11px] font-bold">{(student.name || 'S').slice(0, 2).toUpperCase()}</span>}<span className="text-[13px] font-medium text-[#1a1a1a]">{student.name}</span></div>;

const getError = (error, fallback) => typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : fallback;

const PromotionModal = ({ children, onClose }) => <div className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4"><div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl p-6"><button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100"><X className="w-4 h-4"/></button>{children}</div></div>;

export const PromoteStudent = () => {
  const [students, setStudents] = useState([]);
  const [setup, setSetup] = useState({ academic_year: '', classes: [] });
  const [sourceYear, setSourceYear] = useState('');
  const [sourceClass, setSourceClass] = useState('');
  const [sourceSection, setSourceSection] = useState('');
  const [selected, setSelected] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');
  const [request, setRequest] = useState(null);
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkDecision, setBulkDecision] = useState('promote');
  const [bulkTargetClass, setBulkTargetClass] = useState('');
  const [bulkTargetSection, setBulkTargetSection] = useState('');

  const load = () => Promise.all([api.get('/students'), api.get('/academic-structure')]).then(([studentData, structureData]) => {
    const realStudents = studentData.data || [];
    const academicSetup = structureData.data || { academic_year: '', classes: [] };
    setStudents(realStudents); setSetup(academicSetup);
    const years = [...new Set(realStudents.map((item) => item.academic_year).filter(Boolean))];
    setSourceYear((current) => current || years.find((year) => year !== academicSetup.academic_year) || years[0] || '');
  });
  useEffect(() => { load().catch((error) => setNotice(getError(error, 'Promotion data could not be loaded.'))).finally(() => setLoading(false)); }, []);

  const yearStudents = students.filter((item) => item.academic_year === sourceYear && (item.status || 'Active') === 'Active');
  const sourceClasses = [...new Set(yearStudents.map((item) => item.class_name).filter(Boolean))];
  const sourceSections = [...new Set(yearStudents.filter((item) => !sourceClass || item.class_name === sourceClass).map((item) => item.section).filter(Boolean))];
  const cohort = yearStudents.filter((item) => sourceClass && sourceSection && item.class_name === sourceClass && item.section === sourceSection);
  const classNames = (setup.classes || []).map((item) => item.name);
  const nextClassFor = (student) => {
    const index = classNames.indexOf(student.class_name);
    return index >= 0 && index < classNames.length - 1 ? classNames[index + 1] : '';
  };
  const sectionsFor = (className) => setup.classes.find((item) => item.name === className)?.sections || [];
  const defaultDecision = (student) => {
    const targetClass = nextClassFor(student);
    return { decision: targetClass ? 'promote' : 'hold', target_class: targetClass, target_section: sectionsFor(targetClass)[0]?.name || '' };
  };
  const toggle = (student) => {
    setSelected((current) => current.includes(student.id) ? current.filter((id) => id !== student.id) : [...current, student.id]);
    setDecisions((current) => current[student.id] ? current : { ...current, [student.id]: defaultDecision(student) });
  };
  const updateDecision = (student, changes) => setDecisions((current) => {
    const next = { ...(current[student.id] || defaultDecision(student)), ...changes };
    if (changes.decision === 'retain') {
      next.target_class = student.class_name;
      next.target_section = sectionsFor(student.class_name).some((item) => item.name === student.section) ? student.section : (sectionsFor(student.class_name)[0]?.name || '');
    }
    if (changes.decision === 'promote') {
      next.target_class = nextClassFor(student);
      next.target_section = sectionsFor(next.target_class)[0]?.name || '';
    }
    if (changes.target_class) next.target_section = sectionsFor(changes.target_class)[0]?.name || '';
    return { ...current, [student.id]: next };
  });
  const selectedStudents = selected.map((id) => students.find((item) => item.id === id)).filter(Boolean);
  const applyToAllSelected = () => {
    if (!selectedStudents.length) return setNotice('Select at least one student first.');
    if (bulkDecision === 'promote' && (!bulkTargetClass || !bulkTargetSection)) return setNotice('Select the target Class and Section to apply to all selected students.');
    setDecisions((current) => ({
      ...current,
      ...Object.fromEntries(selectedStudents.map((student) => {
        if (bulkDecision === 'retain') {
          const availableSections = sectionsFor(student.class_name);
          return [student.id, {
            decision: 'retain', target_class: student.class_name,
            target_section: availableSections.some((item) => item.name === student.section) ? student.section : (availableSections[0]?.name || ''),
          }];
        }
        if (bulkDecision === 'promote') return [student.id, { decision: 'promote', target_class: bulkTargetClass, target_section: bulkTargetSection }];
        return [student.id, { decision: bulkDecision, target_class: '', target_section: '' }];
      })),
    }));
    setNotice(`Applied “${decisionLabel[bulkDecision]}” to ${selectedStudents.length} selected student${selectedStudents.length === 1 ? '' : 's'}.`);
  };
  const summary = selectedStudents.reduce((result, student) => { const key = decisions[student.id]?.decision || defaultDecision(student).decision; result[key] = (result[key] || 0) + 1; return result; }, {});
  const canReview = sourceYear && sourceYear !== setup.academic_year && selected.length > 0 && selectedStudents.every((student) => {
    const item = decisions[student.id] || defaultDecision(student);
    return !['promote', 'retain'].includes(item.decision) || (item.target_class && item.target_section);
  });

  const requestApproval = async () => {
    setBusy(true); setNotice('');
    try {
      const { data } = await api.post('/student-promotion-request', {
        source_year: sourceYear, target_year: setup.academic_year,
        entries: selectedStudents.map((student) => ({ student_id: student.id, ...(decisions[student.id] || defaultDecision(student)) })),
      });
      setRequest(data); setModal('otp');
    } catch (error) { setNotice(getError(error, 'The promotion approval request could not be created.')); setModal(''); }
    finally { setBusy(false); }
  };
  const confirmPromotion = async () => {
    if (otp.length !== 6) return setNotice('Enter the 6-digit approval code received by the Principal or Director.');
    setBusy(true); setNotice('');
    try {
      await api.post(`/student-promotion-request/${request.id}/confirm`, { otp });
      await load(); setSelected([]); setDecisions({}); setOtp(''); setModal('success');
    } catch (error) { setNotice(getError(error, 'The promotion could not be completed.')); }
    finally { setBusy(false); }
  };

  const decisionLabel = { promote: 'Promote', retain: 'Retain in same class', hold: 'Hold result', transfer: 'Transfer out', discontinue: 'Discontinue' };
  return <Layout><PageTitle title="Student Promotion & Academic Rollover" subtitle="Create the next-year enrolment while preserving every previous-year record." />
    {notice && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">{notice}</div>}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <Card title="1. Source Academic Year"><select value={sourceYear} onChange={(e) => { setSourceYear(e.target.value); setSourceClass(''); setSourceSection(''); setSelected([]); }} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-[13px]"><option value="">Select completed year</option>{[...new Set(students.map((item) => item.academic_year).filter(Boolean))].map((year) => <option key={year}>{year}</option>)}</select></Card>
      <Card title="2. Promotion Cohort"><div className="grid grid-cols-2 gap-2"><select value={sourceClass} onChange={(e) => { setSourceClass(e.target.value); setSourceSection(''); setSelected([]); }} className="h-11 rounded-lg border border-gray-200 px-3 text-[13px]"><option value="">Class</option>{sourceClasses.map((name) => <option key={name}>{name}</option>)}</select><select value={sourceSection} onChange={(e) => { setSourceSection(e.target.value); setSelected([]); }} className="h-11 rounded-lg border border-gray-200 px-3 text-[13px]"><option value="">Section</option>{sourceSections.map((name) => <option key={name}>{name}</option>)}</select></div></Card>
      <Card title="3. Target Academic Year"><div className="h-11 rounded-lg bg-indigo-50 px-3 flex items-center justify-between text-[13px]"><span className="font-semibold text-indigo-700">{setup.academic_year || 'Not configured'}</span><Badge color="blue">New enrolment</Badge></div></Card>
    </div>
    {sourceYear === setup.academic_year && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-800">First change and approve the new Academic Year in Academic Setup. The completed year will remain on student history.</div>}
    <Card title="Promotion Decisions" subtitle="Select the students, then confirm each student’s next-year outcome.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><p className="text-[12px] text-[#777]">{cohort.length} students in this Class and Section</p><div className="flex items-center gap-2"><Btn variant="outline" disabled={!cohort.length} onClick={() => { const allIds = cohort.map((student) => student.id); setSelected(selected.length === allIds.length ? [] : allIds); setDecisions((current) => ({ ...current, ...Object.fromEntries(cohort.map((student) => [student.id, current[student.id] || defaultDecision(student)])) })); }}>{selected.length === cohort.length && cohort.length ? 'Clear cohort' : 'Select entire cohort'}</Btn><Btn icon={GraduationCap} disabled={!canReview} onClick={() => setModal('review')}>Review selected ({selected.length})</Btn></div></div>
      <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><div className="flex items-center justify-between gap-3 mb-3"><div><p className="text-[13px] font-semibold text-indigo-950">Apply one decision to all selected students</p><p className="text-[11px] text-indigo-600 mt-0.5">Set it once instead of updating every row separately.</p></div><Badge color="blue">{selected.length} selected</Badge></div><div className="grid grid-cols-1 md:grid-cols-4 gap-2"><select value={bulkDecision} onChange={(e) => { setBulkDecision(e.target.value); if (e.target.value !== 'promote') { setBulkTargetClass(''); setBulkTargetSection(''); } }} className="h-10 rounded-lg border border-indigo-100 bg-white px-3 text-[12px]"><option value="promote">Promote all selected</option><option value="retain">Retain all selected</option><option value="hold">Hold all selected</option><option value="transfer">Transfer out all selected</option><option value="discontinue">Discontinue all selected</option></select><select disabled={bulkDecision !== 'promote'} value={bulkTargetClass} onChange={(e) => { const value = e.target.value; setBulkTargetClass(value); setBulkTargetSection(sectionsFor(value)[0]?.name || ''); }} className="h-10 rounded-lg border border-indigo-100 bg-white px-3 text-[12px] disabled:bg-gray-50"><option value="">Target class for all</option>{setup.classes.map((entry) => <option key={entry.id || entry.name} value={entry.name}>{entry.name}</option>)}</select><select disabled={bulkDecision !== 'promote' || !bulkTargetClass} value={bulkTargetSection} onChange={(e) => setBulkTargetSection(e.target.value)} className="h-10 rounded-lg border border-indigo-100 bg-white px-3 text-[12px] disabled:bg-gray-50"><option value="">Target section for all</option>{sectionsFor(bulkTargetClass).map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}</select><Btn onClick={applyToAllSelected} disabled={!selected.length}>Apply to selected</Btn></div></div>
      {loading ? <div className="py-10 text-center"><Loader2 className="inline w-5 h-5 animate-spin text-[#888]"/></div> : <div className="overflow-x-auto"><Table columns={[{label:'Select'},{label:'Student'},{label:'Current enrolment'},{label:'Decision'},{label:'Target class'},{label:'Target section'}]}>{cohort.map((student) => {
        const item = decisions[student.id] || defaultDecision(student); const needsTarget = ['promote', 'retain'].includes(item.decision);
        return <tr key={student.id} className="border-b border-gray-100 last:border-0"><td className="py-3"><button onClick={() => toggle(student)} className={`w-5 h-5 rounded flex items-center justify-center ${selected.includes(student.id) ? 'bg-indigo-600' : 'border border-gray-300'}`}>{selected.includes(student.id) && <Check className="w-3.5 h-3.5 text-white"/>}</button></td><td className="py-3"><Person student={student}/><span className="ml-11 text-[11px] text-gray-400">{student.admission_no}</span></td><td className="py-3 text-[13px] text-gray-600">{student.class_name} · {student.section}</td><td className="py-3"><select value={item.decision} onChange={(e) => updateDecision(student, { decision: e.target.value })} className="h-9 min-w-[155px] rounded-lg border border-gray-200 px-2 text-[12px]">{Object.entries(decisionLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="py-3"><select disabled={!needsTarget || item.decision === 'retain'} value={item.target_class} onChange={(e) => updateDecision(student, { target_class: e.target.value })} className="h-9 min-w-[125px] rounded-lg border border-gray-200 px-2 text-[12px] disabled:bg-gray-50"><option value="">Not applicable</option>{setup.classes.map((entry) => <option key={entry.id || entry.name} value={entry.name}>{entry.name}</option>)}</select></td><td className="py-3"><select disabled={!needsTarget} value={item.target_section} onChange={(e) => updateDecision(student, { target_section: e.target.value })} className="h-9 min-w-[125px] rounded-lg border border-gray-200 px-2 text-[12px] disabled:bg-gray-50"><option value="">Not applicable</option>{sectionsFor(item.target_class).map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}</select></td></tr>;
      })}{!cohort.length && <tr><td colSpan="6" className="py-12 text-center text-[13px] text-gray-400">Select a completed Academic Year, Class and Section to load its active students.</td></tr>}</Table></div>}
    </Card>

    {modal === 'review' && <PromotionModal onClose={() => setModal('')}><div className="flex items-center gap-3 mb-4"><span className="p-3 rounded-xl bg-amber-50"><AlertTriangle className="w-6 h-6 text-amber-600"/></span><div><h3 className="text-xl font-bold">Review annual rollover</h3><p className="text-[13px] text-gray-500">{sourceYear} → {setup.academic_year}</p></div></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">{Object.entries(summary).map(([key, count]) => <div key={key} className="rounded-xl bg-gray-50 p-3"><p className="text-lg font-bold">{count}</p><p className="text-[11px] text-gray-500">{decisionLabel[key]}</p></div>)}</div><div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-[13px] leading-6 text-indigo-900"><strong>Previous records will not be deleted or overwritten.</strong> Attendance, marks, report cards, fees, receipts, homework and interventions remain in {sourceYear}. Promoted and retained students receive a new {setup.academic_year} enrolment.</div><div className="flex justify-end gap-2 mt-5"><Btn variant="outline" onClick={() => setModal('')}>Cancel</Btn><Btn icon={ShieldCheck} onClick={requestApproval} disabled={busy}>{busy ? 'Requesting…' : 'Request Director / Principal OTP'}</Btn></div></PromotionModal>}
    {modal === 'otp' && <PromotionModal onClose={() => setModal('')}><div className="text-center"><span className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center"><KeyRound className="w-7 h-7 text-indigo-600"/></span><h3 className="text-xl font-bold mt-4">Enter approval OTP</h3><p className="mt-2 text-[13px] text-gray-500">The 6-digit code is visible to the Principal or Director and expires in 30 minutes.</p><input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="••••••" className="mt-5 w-full h-14 rounded-xl border border-gray-200 text-center text-2xl tracking-[0.45em]"/><Btn icon={Check} className="w-full mt-4" disabled={busy || otp.length !== 6} onClick={confirmPromotion}>{busy ? 'Confirming…' : 'Confirm & create new enrolments'}</Btn></div></PromotionModal>}
    {modal === 'success' && <PromotionModal onClose={() => setModal('')}><div className="text-center"><span className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center"><Check className="w-7 h-7 text-emerald-600"/></span><h3 className="text-xl font-bold mt-4">Promotion completed</h3><p className="mt-2 text-[13px] leading-6 text-gray-500">New-year enrolments were created successfully. Every previous-year record remains preserved in student academic history.</p><Btn className="w-full mt-5" onClick={() => setModal('')}>Done</Btn></div></PromotionModal>}
  </Layout>;
};

export const TransferStudent = () => {
  const [students, setStudents] = useState([]); const [selected, setSelected] = useState(''); const [loading, setLoading] = useState(true); const student = students.find((item) => item.id === selected);
  useEffect(() => { api.get('/students').then(({ data }) => setStudents(data)).finally(() => setLoading(false)); }, []);
  return <Layout><PageTitle title="Transfer Student" subtitle="Select a real enrolled student to issue a transfer." />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Card title="Transfer Details" className="lg:col-span-1 self-start"><div className="space-y-4"><select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-[13px]"><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.class_name} {item.section}</option>)}</select><select className="w-full h-11 rounded-lg border border-gray-200 px-3 text-[13px]"><option>Branch Transfer</option><option>School Withdrawal</option><option>Section Change</option></select><input placeholder="Reason for transfer" className="w-full h-11 rounded-lg border border-gray-200 px-3 text-[13px]"/><input type="date" className="w-full h-11 rounded-lg border border-gray-200 px-3 text-[13px]"/><Btn icon={ArrowRightLeft} className="w-full" onClick={() => alert(student ? `Transfer request prepared for ${student.name}.` : 'Select a student first.')}>Issue Transfer</Btn></div></Card><Card title="Selected Student" className="lg:col-span-2 self-start">{loading ? <div className="py-10 text-center"><Loader2 className="inline w-5 h-5 animate-spin text-[#888]"/></div> : student ? <div className="flex items-center gap-4 p-3"><Person student={student}/><Badge color="blue">{student.class_name} · {student.section}</Badge></div> : <p className="py-10 text-center text-[13px] text-[#999]">Select a real student from the list. No demo transfers are displayed.</p>}</Card></div>
  </Layout>;
};
