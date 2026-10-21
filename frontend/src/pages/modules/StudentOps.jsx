import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, Card, Btn, Badge, Table } from '../../components/Shared';
import { ArrowRightLeft, GraduationCap, Check, Loader2, AlertTriangle, KeyRound, ShieldCheck, X, ClipboardCheck, ReceiptIndianRupee, BookOpen, Bus, FileText, Printer, Building2, History, UserCheck, Search, Download } from 'lucide-react';
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
  const emptyForm = { student_id: '', transfer_type: 'School Transfer / TC', reason: '', effective_date: new Date().toISOString().slice(0, 10), destination_school: '', destination_branch: '', target_class: '', target_section: '', parent_request_no: '', remarks: '' };
  const clearanceItems = [
    ['fee_cleared', 'Fee clearance', ReceiptIndianRupee, 'All fee heads are settled or formally waived.'],
    ['library_cleared', 'Library clearance', BookOpen, 'Books and library items have been returned.'],
    ['transport_cleared', 'Transport clearance', Bus, 'Route dues and transport fees are cleared.'],
    ['class_teacher_cleared', 'Class teacher clearance', UserCheck, 'Attendance, marks and classroom records are complete.'],
    ['documents_returned', 'Document verification', FileText, 'Original documents and copies are accounted for.'],
  ];
  const [students, setStudents] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [studentFilters, setStudentFilters] = useState({ class_name: '', section: '', search: '' });
  const [historyFilters, setHistoryFilters] = useState({ class_name: '', section: '', month: '' });
  const [active, setActive] = useState(null);
  const [printable, setPrintable] = useState(null);
  const [printHistory, setPrintHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const student = students.find((item) => item.id === form.student_id);
  const activeStudents = students.filter((item) => (item.status || 'Active') === 'Active');
  const studentClasses = [...new Set(activeStudents.map((item) => item.class_name).filter(Boolean))].sort();
  const studentSections = [...new Set(activeStudents.filter((item) => !studentFilters.class_name || item.class_name === studentFilters.class_name).map((item) => item.section).filter(Boolean))].sort();
  const filteredStudents = activeStudents.filter((item) => {
    const query = studentFilters.search.trim().toLowerCase();
    return (!studentFilters.class_name || item.class_name === studentFilters.class_name)
      && (!studentFilters.section || item.section === studentFilters.section)
      && (!query || `${item.name} ${item.admission_no} ${item.roll}`.toLowerCase().includes(query));
  });
  const historyClasses = [...new Set(transfers.map((item) => item.source_class).filter(Boolean))].sort();
  const historySections = [...new Set(transfers.filter((item) => !historyFilters.class_name || item.source_class === historyFilters.class_name).map((item) => item.source_section).filter(Boolean))].sort();
  const filteredTransfers = transfers.filter((item) => (!historyFilters.class_name || item.source_class === historyFilters.class_name)
    && (!historyFilters.section || item.source_section === historyFilters.section)
    && (!historyFilters.month || String(item.effective_date || item.created_at || '').slice(0, 7) === historyFilters.month));
  const input = 'w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-50';

  const load = async () => {
    const [studentResponse, transferResponse, settingsResponse] = await Promise.all([api.get('/students'), api.get('/student-transfers'), api.get('/settings')]);
    setStudents(studentResponse.data || []); setTransfers(transferResponse.data || []); setSettings(settingsResponse.data?.settings || {});
  };
  useEffect(() => { load().catch((error) => setNotice(getError(error, 'Transfer records could not be loaded.'))).finally(() => setLoading(false)); }, []);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const createTransfer = async () => {
    if (!form.student_id) return setNotice('Select a student first.');
    setBusy(true); setNotice('');
    try {
      const { data } = await api.post('/student-transfers', form);
      setActive(data); setTransfers((current) => [data, ...current]); setNotice('Transfer request created. Complete the five school clearances before issue.');
    } catch (error) { setNotice(getError(error, 'The transfer request could not be created.')); }
    finally { setBusy(false); }
  };
  const clearanceValue = (value) => value === true ? 'Yes' : value === false || !value ? 'No' : value;
  const updateClearances = async (clearances) => {
    setActive((current) => ({ ...current, clearances }));
    try {
      const { data } = await api.put(`/student-transfers/${active.id}/clearances`, clearances);
      const updated = { ...active, clearances: data.clearances, status: data.status };
      setActive(updated); setTransfers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) { setNotice(getError(error, 'The clearance could not be updated.')); await load(); }
  };
  const updateClearance = (key, value) => updateClearances(Object.fromEntries(clearanceItems.map(([itemKey]) => [itemKey, itemKey === key ? value : clearanceValue(active?.clearances?.[itemKey])])));
  const updateAllClearances = (value) => updateClearances(Object.fromEntries(clearanceItems.map(([key]) => [key, value])));
  const issueTransfer = async () => {
    setBusy(true); setNotice('');
    try {
      const { data } = await api.post(`/student-transfers/${active.id}/issue`);
      setActive(data); setTransfers((current) => current.map((item) => item.id === data.id ? data : item)); setNotice(`${data.tc_number} issued successfully. The student’s previous records remain preserved.`); await load();
    } catch (error) { setNotice(getError(error, 'The transfer could not be issued.')); }
    finally { setBusy(false); }
  };
  const printCertificate = (record) => { setPrintHistory(false); setPrintable(record); window.setTimeout(() => window.print(), 150); };
  const printHistoryReport = () => { setPrintable(null); setPrintHistory(true); window.setTimeout(() => window.print(), 150); };
  const clearanceCount = active ? clearanceItems.filter(([key]) => ['Yes', 'No', 'Not Applicable'].includes(clearanceValue(active.clearances?.[key]))).length : 0;
  const badgeColor = (status) => status === 'Issued' ? 'green' : status === 'Ready for Approval' ? 'blue' : 'amber';

  return <Layout>
    <PageTitle title="Student Transfer & TC Desk" subtitle="Process branch transfers and school-leaving certificates with clearances, approval and a permanent audit trail." />
    {notice && <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[12px] font-medium text-indigo-800">{notice}</div>}
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        ['Active students', activeStudents.length, UserCheck, 'bg-blue-50 text-blue-600'],
        ['Pending clearance', transfers.filter((item) => item.status === 'Pending Clearance').length, ClipboardCheck, 'bg-amber-50 text-amber-600'],
        ['Ready to issue', transfers.filter((item) => item.status === 'Ready for Approval').length, ShieldCheck, 'bg-indigo-50 text-indigo-600'],
        ['Certificates issued', transfers.filter((item) => item.status === 'Issued').length, FileText, 'bg-emerald-50 text-emerald-600'],
      ].map(([label, value, Icon, tone]) => <div key={label} className="rounded-2xl border border-white bg-white p-4 shadow-sm ring-1 ring-slate-100"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span><p className="mt-3 text-[22px] font-bold text-slate-900">{value}</p><p className="text-[10px] font-medium text-slate-500">{label}</p></div>)}
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.45fr]">
      <Card title="1. Start transfer request" subtitle="Select the student and choose the exact school movement.">
        <div className="space-y-4">
          <div><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Find active student</span><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><select value={studentFilters.class_name} onChange={(event) => { setStudentFilters((current) => ({ ...current, class_name: event.target.value, section: '' })); change('student_id', ''); }} className={input}><option value="">All classes</option>{studentClasses.map((name) => <option key={name}>{name}</option>)}</select><select value={studentFilters.section} onChange={(event) => { setStudentFilters((current) => ({ ...current, section: event.target.value })); change('student_id', ''); }} className={input}><option value="">All sections</option>{studentSections.map((name) => <option key={name}>{name}</option>)}</select></div><div className="relative mt-2"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input value={studentFilters.search} onChange={(event) => setStudentFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, admission no. or roll no." className={`${input} pl-9`} /></div></div>
          <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Student ({filteredStudents.length} found)</span><select value={form.student_id} onChange={(event) => change('student_id', event.target.value)} className={input}><option value="">Select student</option>{filteredStudents.map((item) => <option key={item.id} value={item.id} label={`${item.name} - ${item.admission_no || item.id} - ${item.class_name} ${item.section}`} />)}</select></label>
          {student && <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4"><Person student={student}/><div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500"><span>Admission: <b className="text-slate-800">{student.admission_no || '—'}</b></span><span>Roll: <b className="text-slate-800">{student.roll || '—'}</b></span><span>Class: <b className="text-slate-800">{student.class_name} {student.section}</b></span><span>Fee balance: <b className={Number(student.balance || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}>₹{Number(student.balance || 0).toLocaleString('en-IN')}</b></span></div></div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Transfer type</span><select value={form.transfer_type} onChange={(event) => change('transfer_type', event.target.value)} className={input}><option>School Transfer / TC</option><option>Branch Transfer</option></select></label><label><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Effective date</span><input type="date" value={form.effective_date} onChange={(event) => change('effective_date', event.target.value)} className={input} /></label></div>
          {form.transfer_type === 'School Transfer / TC' && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Destination school</span><input value={form.destination_school} onChange={(event) => change('destination_school', event.target.value)} placeholder="School name and city" className={input} /></label>}
          {form.transfer_type === 'Branch Transfer' && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Destination branch</span><input value={form.destination_branch} onChange={(event) => change('destination_branch', event.target.value)} placeholder="Branch / campus name" className={input} /></label>}
          <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Reason for transfer</span><textarea value={form.reason} onChange={(event) => change('reason', event.target.value)} rows="3" placeholder="Record the parent’s reason clearly" className={`${input} h-auto py-3`} /></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Admission number</span><input value={student?.admission_no || ''} readOnly placeholder="Select a student" className={`${input} bg-slate-50 text-slate-600`} /></label><label><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Office remarks <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></span><input value={form.remarks} onChange={(event) => change('remarks', event.target.value)} placeholder="Internal note" className={input} /></label></div>
          <Btn icon={ArrowRightLeft} className="w-full" disabled={busy || !form.student_id} onClick={createTransfer}>{busy ? 'Creating request…' : 'Create clearance request'}</Btn>
        </div>
      </Card>

      <Card title="2. School clearance & issue" subtitle="Record each department’s decision as Yes, No or Not Applicable before issuing.">
        {!active ? <div className="flex min-h-[430px] flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><ClipboardCheck className="h-6 w-6 text-slate-400" /></span><p className="mt-4 text-[13px] font-bold text-slate-700">No request selected</p><p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-400">Create a new request or open one from Transfer History to continue the clearance workflow.</p></div> : <div>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-slate-950 p-5 text-white"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{active.id}</p><h3 className="mt-2 text-[18px] font-bold">{active.student_name}</h3><p className="mt-1 text-[10px] text-white/55">{active.admission_no} · {active.source_class} {active.source_section} · {active.transfer_type}</p></div><Badge color={badgeColor(active.status)}>{active.status}</Badge></div>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[12px] font-bold text-slate-800">Department clearances</p><p className="text-[10px] text-slate-400">{clearanceCount} of {clearanceItems.length} decisions recorded</p></div><span className="text-[20px] font-bold text-indigo-600">{Math.round(clearanceCount / clearanceItems.length * 100)}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${clearanceCount / clearanceItems.length * 100}%` }} /></div>
          {active.status !== 'Issued' && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => updateAllClearances('Yes')} className="rounded-lg bg-emerald-50 px-3 py-2 text-[9px] font-bold text-emerald-700">Mark all Yes</button><button onClick={() => updateAllClearances('Not Applicable')} className="rounded-lg bg-blue-50 px-3 py-2 text-[9px] font-bold text-blue-700">Mark all N/A</button><button onClick={() => updateAllClearances('No')} className="rounded-lg bg-amber-50 px-3 py-2 text-[9px] font-bold text-amber-700">Mark all No</button></div>}
          <div className="mt-4 space-y-2">{clearanceItems.map(([key, label, Icon, copy]) => { const value = clearanceValue(active.clearances?.[key]); const complete = value === 'Yes' || value === 'Not Applicable'; return <div key={key} className={`flex items-start gap-3 rounded-xl border p-3 transition ${complete ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-100 bg-white'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${complete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block text-[11px] text-slate-700">{label}</b><small className="mt-0.5 block text-[9px] leading-4 text-slate-400">{copy}</small></span><select value={value} disabled={active.status === 'Issued'} onChange={(event) => updateClearance(key, event.target.value)} className={`h-9 rounded-lg border px-2 text-[10px] font-bold outline-none ${value === 'Yes' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : value === 'Not Applicable' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}><option>Yes</option><option>No</option><option>Not Applicable</option></select></div>; })}</div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">{active.status === 'Issued' ? <><Btn variant="outline" icon={Printer} onClick={() => printCertificate(active)}>Print / Download TC</Btn><Badge color="green">{active.tc_number}</Badge></> : <Btn icon={ShieldCheck} disabled={busy || clearanceCount !== clearanceItems.length} onClick={issueTransfer}>{busy ? 'Issuing…' : 'Approve & issue transfer'}</Btn>}</div>
        </div>}
      </Card>
    </div>

    <Card title="Transfer history" subtitle="Filter the audit register by Class, Section and month, then download the visible report as PDF." className="mt-6" pad="p-0">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/70 p-4"><label className="min-w-[150px] flex-1"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Class</span><select value={historyFilters.class_name} onChange={(event) => setHistoryFilters((current) => ({ ...current, class_name: event.target.value, section: '' }))} className={input}><option value="">All classes</option>{historyClasses.map((name) => <option key={name}>{name}</option>)}</select></label><label className="min-w-[140px] flex-1"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Section</span><select value={historyFilters.section} onChange={(event) => setHistoryFilters((current) => ({ ...current, section: event.target.value }))} className={input}><option value="">All sections</option>{historySections.map((name) => <option key={name}>{name}</option>)}</select></label><label className="min-w-[150px] flex-1"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Month</span><input type="month" value={historyFilters.month} onChange={(event) => setHistoryFilters((current) => ({ ...current, month: event.target.value }))} className={input} /></label><Btn variant="outline" onClick={() => setHistoryFilters({ class_name: '', section: '', month: '' })}>Clear filters</Btn><Btn icon={Download} disabled={!filteredTransfers.length} onClick={printHistoryReport}>Download PDF report</Btn></div>
      <div className="overflow-x-auto"><Table columns={[{ label: 'Request / Student' }, { label: 'Class / Section' }, { label: 'Movement' }, { label: 'Effective date' }, { label: 'Clearance' }, { label: 'Status' }, { label: 'Action' }]}>{filteredTransfers.map((item) => { const done = clearanceItems.filter(([key]) => ['Yes', 'Not Applicable'].includes(clearanceValue(item.clearances?.[key]))).length; return <tr key={item.id} className="border-b border-slate-50 last:border-0"><td className="px-6 py-3"><b className="block text-[11px] text-slate-800">{item.student_name}</b><span className="text-[9px] text-slate-400">{item.id} · {item.admission_no}</span></td><td className="py-3 text-[10px] font-medium text-slate-600">{item.source_class}<span className="block text-[9px] text-slate-400">{item.source_section}</span></td><td className="py-3"><span className="text-[11px] font-medium text-slate-600">{item.transfer_type}</span><small className="block max-w-[190px] truncate text-[9px] text-slate-400">{item.destination_school || item.destination_branch || item.reason}</small></td><td className="py-3 text-[10px] text-slate-500">{item.effective_date || '—'}</td><td className="py-3 text-[10px] font-semibold text-slate-600">{done}/{clearanceItems.length}</td><td className="py-3"><Badge color={badgeColor(item.status)}>{item.status}</Badge></td><td className="py-3 pr-6"><button onClick={() => setActive(item)} className="text-[10px] font-bold text-indigo-600">{item.status === 'Issued' ? 'View certificate' : 'Continue'}</button>{item.status === 'Issued' && <button onClick={() => printCertificate(item)} className="ml-3 text-[10px] font-bold text-slate-500">Print</button>}</td></tr>; })}</Table>{!loading && !filteredTransfers.length && <div className="py-14 text-center"><History className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-[12px] text-slate-400">No transfer records match the selected filters.</p></div>}{loading && <div className="py-14 text-center"><Loader2 className="inline h-5 w-5 animate-spin text-indigo-500" /></div>}</div>
    </Card>

    {printHistory && <div id="transfer-history-report" className="hidden bg-white p-8 text-slate-900"><style>{`@media print{body *{visibility:hidden!important}#transfer-history-report,#transfer-history-report *{visibility:visible!important}#transfer-history-report{display:block!important;position:absolute;left:0;top:0;width:100%}@page{size:A4 landscape;margin:10mm}}`}</style><header className="mb-5 border-b-4 border-indigo-950 pb-4"><h1 className="text-[22px] font-black">{settings.schoolName || 'Orison School'} - Student Transfer Report</h1><p className="mt-1 text-[10px] text-slate-500">Class: {historyFilters.class_name || 'All'} · Section: {historyFilters.section || 'All'} · Month: {historyFilters.month || 'All'} · Records: {filteredTransfers.length}</p></header><table className="w-full border-collapse text-[9px]"><thead><tr className="bg-indigo-950 text-white"><th className="border p-2">Request ID</th><th className="border p-2">Student</th><th className="border p-2">Admission No.</th><th className="border p-2">Class / Section</th><th className="border p-2">Transfer Type</th><th className="border p-2">Destination</th><th className="border p-2">Effective Date</th><th className="border p-2">Clearance</th><th className="border p-2">Status / TC</th></tr></thead><tbody>{filteredTransfers.map((item) => { const done = clearanceItems.filter(([key]) => ['Yes', 'Not Applicable'].includes(clearanceValue(item.clearances?.[key]))).length; return <tr key={item.id}><td className="border p-2">{item.id}</td><td className="border p-2 font-bold">{item.student_name}</td><td className="border p-2">{item.admission_no}</td><td className="border p-2">{item.source_class} / {item.source_section}</td><td className="border p-2">{item.transfer_type}</td><td className="border p-2">{item.destination_school || item.destination_branch || '—'}</td><td className="border p-2">{item.effective_date || '—'}</td><td className="border p-2">{done}/{clearanceItems.length}</td><td className="border p-2">{item.status}{item.tc_number ? ` / ${item.tc_number}` : ''}</td></tr>; })}</tbody></table><footer className="mt-6 flex justify-between border-t pt-3 text-[8px] text-slate-400"><span>Generated from Orison ERP</span><span>{new Date().toLocaleString('en-IN')}</span></footer></div>}

    {printable && <div id="transfer-certificate" className="hidden bg-white p-10 text-slate-900"><style>{`@media print{body *{visibility:hidden!important}#transfer-certificate,#transfer-certificate *{visibility:visible!important}#transfer-certificate{display:block!important;position:absolute;left:0;top:0;width:100%;min-height:277mm}@page{size:A4 portrait;margin:12mm}}`}</style><header className="border-b-4 border-indigo-950 pb-5 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-indigo-950"><Building2 className="h-8 w-8 text-indigo-950" /></div><h1 className="mt-3 text-[25px] font-black uppercase tracking-wide">{settings.schoolName || 'Orison School'}</h1><p className="mt-1 text-[10px]">{settings.address || 'School address'} · {settings.phone || ''} · {settings.email || ''}</p></header><div className="mt-7 flex items-center justify-between"><div><p className="text-[10px] text-slate-500">Transfer Certificate No.</p><b>{printable.tc_number || 'Pending'}</b></div><div className="text-right"><p className="text-[10px] text-slate-500">Issue date</p><b>{printable.issued_at ? new Date(printable.issued_at).toLocaleDateString('en-IN') : '—'}</b></div></div><h2 className="my-8 text-center text-[22px] font-black uppercase tracking-[0.2em] underline">Transfer Certificate</h2><p className="text-[13px] leading-8">This is to certify that <b>{printable.student_name}</b>, Admission No. <b>{printable.admission_no}</b>, was a bona fide student of this school in <b>{printable.source_class} {printable.source_section}</b> during the Academic Year <b>{printable.academic_year}</b>.</p><div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-slate-300 py-5 text-[12px]"><p><span className="text-slate-500">Transfer type:</span><br/><b>{printable.transfer_type}</b></p><p><span className="text-slate-500">Effective date:</span><br/><b>{printable.effective_date}</b></p><p><span className="text-slate-500">Reason:</span><br/><b>{printable.reason}</b></p><p><span className="text-slate-500">Destination:</span><br/><b>{printable.destination_school || printable.destination_branch || printable.target_section || '—'}</b></p><p><span className="text-slate-500">Parent / Guardian:</span><br/><b>{printable.parent_name || '—'}</b></p><p><span className="text-slate-500">Request reference:</span><br/><b>{printable.parent_request_no || '—'}</b></p></div><p className="mt-6 text-[12px] leading-7">All applicable school clearances have been completed. The student’s academic records remain preserved in the school register.</p><div className="mt-28 grid grid-cols-3 gap-12 text-center text-[10px]"><p className="border-t border-slate-500 pt-2">Class Teacher</p><p className="border-t border-slate-500 pt-2">Office In-charge</p><p className="border-t border-slate-500 pt-2">Principal / Director</p></div><footer className="mt-14 flex items-center justify-between border-t pt-3 text-[9px] text-slate-400"><span>Generated from Orison ERP</span><span>{printable.id}</span></footer></div>}
  </Layout>;
};
