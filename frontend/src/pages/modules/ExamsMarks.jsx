import React, { useEffect, useState } from 'react';
import { askText } from '../../components/AppFeedback';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table } from '../../components/Shared';
import { RESULTS } from '../../mock2';
import { GRADE_SHEET, STUDENT } from '../../mock';
import { FileText, CalendarClock, CheckCircle2, Plus, Download, Trophy, Award, Printer, Loader2, Eye, X, BookOpen, Clock3, MapPin, GraduationCap, TrendingUp, Users, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { filterRows, downloadCSV, isActiveStudentOn, printPage } from '../../utils';
import { useAuth } from '../../context/AuthContext';

export const ViewExam = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('All');
  useEffect(() => { api.get('/exams').then(({ data }) => { setExams(data); setLoading(false); }).catch(() => setLoading(false)); }, []);
  const cnt = (s) => exams.filter((e) => e.status === s).length;
  const classOptions = [...new Set(exams.map((exam) => exam.class_name).filter(Boolean))].sort();
  const sectionOptions = [...new Set(exams.filter((exam) => !selectedClass || exam.class_name === selectedClass).map((exam) => exam.section).filter(Boolean))].sort();
  const rows = filterRows(exams, q, ['title', 'class_name', 'subject', 'status']).filter((exam) => (selectedStatus === 'All' || exam.status === selectedStatus) && (!selectedClass || exam.class_name === selectedClass) && (!selectedSection || exam.section === selectedSection));
  const exportCSV = () => downloadCSV('exams.csv', ['Title', 'Class', 'Subject', 'Component', 'Date', 'Room', 'Status'], rows.map((e) => [e.title, e.class_name, e.subject, e.assessment_component || 'Theory', e.date, e.room, e.status]));
  return (
    <Layout>
      <PageTitle title="View Exams" subtitle="All scheduled, draft and completed examinations."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus} onClick={() => navigate('/exams/create')}>Create Exam</Btn></>} />
      <div className="mb-6 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-[0_24px_55px_rgba(49,46,129,0.22)]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-indigo-100"><GraduationCap className="h-3.5 w-3.5" /> Examination workspace</div><h3 className="font-poppins text-[25px] font-bold tracking-[-0.04em]">One clear view of every assigned exam</h3><p className="mt-2 max-w-2xl text-[13px] leading-5 text-indigo-100/75">Review the assigned class, subjects, schedule, marks and grading rules before the examination begins.</p></div>
          <div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-white/[0.08] p-2 backdrop-blur">
            {[['All', exams.length, 'All'], ['Scheduled', cnt('Scheduled'), 'Scheduled'], ['Completed', cnt('Completed'), 'Completed'], ['Drafts', cnt('Draft'), 'Draft']].map(([label, value, status]) => <button type="button" onClick={() => setSelectedStatus(status)} key={label} className={`min-w-[78px] rounded-xl px-3 py-3 text-center transition ${selectedStatus === status ? 'bg-white text-indigo-950' : 'bg-white/[0.08] text-white'}`}><p className="font-poppins text-[20px] font-bold">{value}</p><p className="mt-0.5 text-[12px] font-semibold uppercase tracking-wider opacity-65">{label}</p></button>)}
          </div>
        </div>
      </div>
      <Card title="Assigned examinations" subtitle="Filter the schedule, then open any exam to review its complete assignment and grading setup.">
        <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-3">
          <select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection(''); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
            <option value="">All Classes</option>{classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
          <select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
            <option value="">All Sections</option>{sectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}
          </select>
          <SearchBar placeholder="Search scheduled exams..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {loading ? <div className="flex justify-center py-10 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <Table columns={[{label:'Exam'},{label:'Assigned group'},{label:'Coverage'},{label:'Schedule'},{label:'Status'},{label:'', align:'right'}]}>
            {rows.map((e) => (
              <tr key={e.id} onClick={() => setSelectedExam(e)} className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-indigo-50/45">
                <td className="py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600"><FileText className="h-4.5 w-4.5" /></span><div><p className="text-[14px] font-bold text-slate-900">{e.title}</p><p className="mt-0.5 text-[12px] font-semibold uppercase tracking-wider text-slate-400">{e.assessment_component || 'Theory'}</p></div></div></td>
                <td className="py-4"><p className="text-[13px] font-bold text-slate-700">{e.class_name}</p><p className="text-[13px] text-slate-400">Section {e.section || '—'}</p></td>
                <td className="max-w-[310px] py-4"><p className="truncate text-[13px] font-medium text-slate-600">{e.subject === 'All Subjects' ? `${(e.subjects || []).length} subjects assigned` : e.subject}</p><p className="mt-1 truncate text-[12px] text-slate-400">{e.subject === 'All Subjects' ? (e.subjects || []).join(' • ') : `${e.max_marks || 100} maximum marks`}</p></td>
                <td className="py-4"><p className="text-[13px] font-semibold text-slate-700">{e.date || 'Date pending'}</p><p className="text-[12px] text-slate-400">{e.start_time && e.end_time ? `${e.start_time} – ${e.end_time}` : e.room || 'Time pending'}</p></td>
                <td className="py-3"><Badge color={e.status==='Completed'?'green':e.status==='Scheduled'?'blue':'amber'}>{e.status}</Badge></td>
                <td className="py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedExam(e); }} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-[13px] font-bold text-indigo-600 shadow-sm transition group-hover:border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white"><Eye className="h-3.5 w-3.5" /> View exam</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-14 text-center"><CalendarClock className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-[14px] font-semibold text-slate-500">No assigned exams match this Class and Section.</p><p className="mt-1 text-[13px] text-slate-400">Change the filters or create a new examination.</p></td></tr>}
          </Table>
        )}
      </Card>
      {selectedExam && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={() => setSelectedExam(null)}><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-[0_30px_90px_rgba(15,23,42,0.32)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-7 text-white"><button type="button" onClick={() => setSelectedExam(null)} className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-4 w-4" /></button><Badge color="blue" className="border-white/15 bg-white/10 text-indigo-100">{selectedExam.status}</Badge><h3 className="mt-4 font-poppins text-[25px] font-bold tracking-[-0.04em]">{selectedExam.title}</h3><p className="mt-1 text-[13px] text-indigo-100/70">Assigned to {selectedExam.class_name} · Section {selectedExam.section || '—'}</p></div>
        <div className="space-y-6 p-7">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
            [CalendarClock, 'Exam date', selectedExam.date || 'Not set'], [Clock3, 'Time', selectedExam.start_time && selectedExam.end_time ? `${selectedExam.start_time} – ${selectedExam.end_time}` : 'Not set'], [MapPin, 'Room', selectedExam.room || 'Not assigned'], [FileText, 'Component', selectedExam.assessment_component || 'Theory'],
          ].map(([Icon, label, value]) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><Icon className="mb-3 h-4 w-4 text-indigo-500" /><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[13px] font-bold text-slate-800">{value}</p></div>)}</div>
          <div className="grid gap-5 md:grid-cols-2"><div className="rounded-2xl border border-slate-100 p-5"><div className="mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-500" /><h4 className="text-[14px] font-bold text-slate-900">Assigned subjects</h4></div><div className="flex flex-wrap gap-2">{(selectedExam.subject === 'All Subjects' ? selectedExam.subjects || [] : [selectedExam.subject]).filter(Boolean).map((subject) => <span key={subject} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[12px] font-bold text-indigo-700">{subject}</span>)}</div></div><div className="rounded-2xl border border-slate-100 p-5"><h4 className="mb-4 text-[14px] font-bold text-slate-900">Marks configuration</h4><div className="space-y-3 text-[13px]"><div className="flex justify-between"><span className="text-slate-400">Maximum marks</span><strong className="text-slate-800">{selectedExam.max_marks || 100}</strong></div><div className="flex justify-between"><span className="text-slate-400">Pass marks</span><strong className="text-slate-800">{selectedExam.passing_marks ?? '—'}</strong></div><div className="flex justify-between"><span className="text-slate-400">Grade ranges</span><strong className="text-slate-800">{(selectedExam.grade_scheme || []).length}</strong></div></div></div></div>
          <div className="rounded-2xl border border-slate-100 p-5"><h4 className="mb-4 text-[14px] font-bold text-slate-900">Grading scale</h4>{(selectedExam.grade_scheme || []).length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{selectedExam.grade_scheme.map((grade, index) => <div key={`${grade.grade}-${index}`} className="rounded-xl bg-slate-50 p-3"><p className="text-[14px] font-bold text-indigo-600">{grade.grade}</p><p className="mt-1 text-[12px] text-slate-500">{grade.from}% – {grade.to}% · {grade.result}</p></div>)}</div> : <p className="text-[13px] text-slate-400">No custom grading scale was assigned to this exam.</p>}</div>
          <div className="flex justify-end"><Btn variant="outline" onClick={() => setSelectedExam(null)}>Close details</Btn></div>
        </div>
      </div></div>}
    </Layout>
  );
};

export const Results = () => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const loadResults = (className = '', section = '', examTitle = '') => {
    setLoading(true);
    api.get('/results', { params: className && section ? { class_name: className, section, ...(examTitle ? { exam_title: examTitle } : {}) } : {} })
      .then(({ data: resultData }) => setData(resultData))
      .catch(() => setData({ available_groups: [], selected: false, rows: [] }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadResults(); }, []);
  const rows = (data?.rows || []).filter((row, index, list) => list.findIndex((item) => (item.student_id || item.roll || item.name) === (row.student_id || row.roll || row.name)) === index);
  const resultSubjects = [...new Set((data?.subjects || []).map((subject) => String(subject).trim()).filter(Boolean))];
  const classOptions = [...new Set((data?.available_groups || []).map((group) => group.class_name))].sort();
  const sectionOptions = [...new Set((data?.available_groups || []).filter((group) => group.class_name === selectedClass).map((group) => group.section))].sort();
  const chooseClass = (event) => { setSelectedClass(event.target.value); setSelectedSection(''); setSelectedExam(''); loadResults(); };
  const chooseSection = (event) => {
    const value = event.target.value;
    setSelectedSection(value);
    setSelectedExam('');
    if (selectedClass && value) loadResults(selectedClass, value);
  };
  const topScorer = data?.top_scorer;
  const passCount = rows.filter((row) => row.result === 'Pass').length;
  const attentionCount = rows.length - passCount;
  const missingSubjects = (data?.expected_subjects || []).filter((subject) => !(data?.subjects || []).includes(subject));
  const subjectValidation = data?.subject_validation || [];
  const enteredSubjects = subjectValidation.filter((item) => item.status !== 'Pending').length;
  const readySubjects = subjectValidation.filter((item) => ['Submitted', 'Published'].includes(item.status)).length;
  const pendingSubjects = subjectValidation.length - enteredSubjects;
  const validationProgress = subjectValidation.length ? Math.round((readySubjects / subjectValidation.length) * 100) : 0;
  const publishReady = subjectValidation.length > 0 && readySubjects === subjectValidation.length && rows.length > 0;
  const openMarksEntry = (subject) => navigate(`/marks/add?class=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}&exam=${encodeURIComponent(data?.exam_id || '')}&subject=${encodeURIComponent(subject)}`);
  const scrollToRegister = () => document.getElementById('student-performance-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const publishResults = async () => {
    if (!data?.exam_id) return;
    setPublishing(true); setNotice('');
    try {
      const response = await api.post(`/exams/${data.exam_id}/publish-results`);
      setNotice(`Results published. ${response.data.parents_notified} parent account(s) were notified.`);
      await loadResults(selectedClass, selectedSection, selectedExam || data.exam_title);
    } catch (error) { setNotice(error.response?.data?.detail || 'Results could not be published.'); }
    finally { setPublishing(false); }
  };
  const reopenSheet = async (sheet) => {
    const reason = await askText(`Why should ${sheet.subject} marks be reopened?`);
    if (!reason?.trim()) return;
    try { await api.post(`/marks/${sheet.id}/reopen`, { reason }); setNotice(`${sheet.subject} was reopened for controlled correction.`); loadResults(selectedClass, selectedSection, selectedExam || data.exam_title); }
    catch (error) { setNotice(error.response?.data?.detail || 'The marks sheet could not be reopened.'); }
  };
  return (
    <Layout>
      <PageTitle title="Results" subtitle={data?.selected ? `${data.exam_title} • ${data.class} • ${resultSubjects.length} subjects` : 'A premium, accurate view of every published school examination.'}
        actions={<><Btn variant="outline" icon={Download} onClick={() => downloadCSV('results.csv', ['Rank', 'Roll', 'Student', ...resultSubjects.flatMap((subject) => [`${subject} Marks`, `${subject} %`]), 'Total', 'Maximum Marks', 'Percentage', 'Grade', 'Result'], rows.map((r) => [r.rank, r.roll, r.name, ...resultSubjects.flatMap((subject) => { const item = (r.subjects || []).find((entry) => entry.subject === subject); return [item?.score ?? item?.appearance_status ?? '', item?.percent ?? '']; }), r.total, r.total_max, r.percent, r.grade, r.result]))}>Download Results</Btn><Btn icon={Trophy} onClick={printPage}>Print Results</Btn></>} />
      {notice && <div className={`mb-5 rounded-2xl border px-4 py-3 text-[13px] font-semibold ${notice.includes('published') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{notice}</div>}
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-[0_24px_60px_rgba(49,46,129,0.24)]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-indigo-100"><Sparkles className="h-3.5 w-3.5" /> Result intelligence</div><h2 className="font-poppins text-[27px] font-bold tracking-[-0.04em]">From marks to meaningful progress</h2><p className="mt-2 max-w-xl text-[13px] leading-5 text-indigo-100/70">Select a class group to review achievement, pass coverage and the students who need timely support.</p></div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="flex min-h-[132px] min-w-[225px] items-center gap-4 rounded-2xl border border-amber-300/35 bg-gradient-to-br from-amber-300/20 to-white/[0.08] px-5 py-4 shadow-[0_14px_34px_rgba(251,191,36,0.14)] backdrop-blur">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300/20 text-amber-200 ring-1 ring-amber-200/25"><Trophy className="h-6 w-6" /></span>
              <div className="min-w-0"><p className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber-100/70">Highest scorer</p><p className="mt-1 truncate font-poppins text-[18px] font-bold">{data?.selected ? topScorer?.name || '—' : '—'}</p><p className="mt-1 text-[13px] font-bold text-amber-200">{topScorer ? `${topScorer.percent}% overall` : 'Select an exam'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2">{[
              [Award, 'Average', data?.selected ? `${data.class_average}%` : '—'],
              [TrendingUp, 'Pass rate', data?.selected ? `${data.pass_rate}%` : '—'],
              [CheckCircle2, 'Passed', data?.selected ? passCount : '—'],
              [ShieldCheck, 'Need support', data?.selected ? attentionCount : '—'],
            ].map(([Icon, label, value]) => <div key={label} className="flex min-w-[126px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-3.5 py-3 backdrop-blur"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-indigo-100"><Icon className="h-4 w-4" /></span><div><p className="font-poppins text-[17px] font-bold leading-none">{value}</p><p className="mt-1.5 text-[12px] font-bold uppercase tracking-wider text-indigo-100/55">{label}</p></div></div>)}</div>
          </div>
        </div>
      </div>
      <Card title="Choose result group" subtitle="Only Class and Section combinations with submitted marks are available.">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-3">
          <select value={selectedClass} onChange={chooseClass} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
            <option value="">Select class</option>{classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
          <select value={selectedSection} onChange={chooseSection} disabled={!selectedClass} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:opacity-50">
            <option value="">Select section</option>{sectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}
          </select>
          <select value={selectedExam} onChange={(event) => { setSelectedExam(event.target.value); loadResults(selectedClass, selectedSection, event.target.value); }} disabled={!selectedSection} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:opacity-50">
            <option value="">Latest school exam</option>{(data?.available_exams || []).map((exam) => <option key={exam} value={exam}>{exam}</option>)}
          </select>
        </div>
      </Card>
      {data?.selected && <>
      <section className="mb-5 overflow-hidden rounded-[28px] border border-indigo-100 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.075)]">
        <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-6">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div className="flex items-start gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${data.publication_status === 'Published' ? 'bg-emerald-100 text-emerald-700' : publishReady ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}><ShieldCheck className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-poppins text-[19px] font-bold text-slate-950">Admin result validation</h3><Badge color={data.publication_status === 'Published' ? 'green' : publishReady ? 'blue' : 'amber'}>{data.publication_status || 'Under Verification'}</Badge></div><p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">Check every subject below. Parents will see nothing until all subjects are submitted and Admin validates the complete examination.</p></div></div>
            {auth?.role === 'admin' && data.publication_status !== 'Published' && <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><button type="button" onClick={scrollToRegister} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 shadow-sm">Review student marks</button><Btn icon={ShieldCheck} disabled={publishing || !publishReady} onClick={publishResults}>{publishing ? 'Publishing…' : 'Validate & Send to Parents'}</Btn></div>}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
            [BookOpen, 'Subjects expected', subjectValidation.length, 'bg-indigo-50 text-indigo-600'],
            [FileText, 'Marks entered', enteredSubjects, 'bg-blue-50 text-blue-600'],
            [Clock3, 'Still pending', pendingSubjects, pendingSubjects ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'],
            [CheckCircle2, 'Ready for validation', readySubjects, publishReady ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'],
          ].map(([Icon, label, value, colorClass]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-white bg-white/90 p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClass}`}><Icon className="h-4.5 w-4.5" /></span><div><p className="font-poppins text-[20px] font-bold leading-none text-slate-900">{value}</p><p className="mt-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div></div>)}</div>
          <div className="mt-5"><div className="flex justify-between text-[12px] font-semibold text-slate-500"><span>Examination readiness</span><span>{validationProgress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-100"><div className={`h-full rounded-full transition-all ${publishReady ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} style={{ width: `${validationProgress}%` }} /></div></div>
        </div>
        <div className="p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-[14px] font-bold text-slate-900">Subject submission tracker</h4><p className="mt-1 text-[12px] text-slate-400">Pending and draft subjects need action. Submitted subjects are ready for Admin review.</p></div><div className="flex flex-wrap gap-2 text-[12px] font-bold"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-600">Pending</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Draft / correction</span><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">Submitted</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Published</span></div></div>
          <div className="grid gap-3 lg:grid-cols-2">{subjectValidation.map((item) => { const isPending = item.status === 'Pending'; const needsWork = ['Draft', 'Correction Required'].includes(item.status); const isReady = item.status === 'Submitted'; const isPublished = item.status === 'Published'; const tone = isPending ? 'border-rose-200 bg-rose-50/45' : needsWork ? 'border-amber-200 bg-amber-50/45' : isPublished ? 'border-emerald-200 bg-emerald-50/45' : 'border-indigo-200 bg-indigo-50/45'; const sheet = (data.sheets || []).find((entry) => entry.subject === item.subject); return <article key={item.subject} className={`rounded-2xl border p-4 ${tone}`}><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isPending ? 'bg-rose-100 text-rose-600' : needsWork ? 'bg-amber-100 text-amber-700' : isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{isPending ? <Clock3 className="h-4.5 w-4.5" /> : <BookOpen className="h-4.5 w-4.5" />}</span><div><h5 className="text-[14px] font-bold text-slate-900">{item.subject}</h5><p className="mt-1 text-[12px] text-slate-500">{item.teacher_name || item.updated_by || 'Marks entry not started'}</p></div></div><Badge color={isPublished ? 'green' : isReady ? 'blue' : isPending ? 'red' : 'amber'}>{item.status}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/75 p-3"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Student coverage</p><p className="mt-1 text-[13px] font-bold text-slate-800">{item.students_completed || 0} / {item.students_total || 0}</p></div><div className="rounded-xl bg-white/75 p-3"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Last updated</p><p className="mt-1 text-[12px] font-bold text-slate-700">{item.updated_at ? new Date(item.updated_at).toLocaleString() : 'Not started'}</p></div></div><div className="mt-3 flex justify-end">{(isPending || needsWork) && <button type="button" onClick={() => openMarksEntry(item.subject)} className={`rounded-xl px-3.5 py-2 text-[12px] font-bold text-white shadow-sm ${isPending ? 'bg-rose-600' : 'bg-amber-600'}`}>{isPending ? 'Enter marks' : needsWork ? 'Continue / update marks' : 'Open marks'}</button>}{isReady && <button type="button" onClick={scrollToRegister} className="rounded-xl bg-indigo-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm">Review submitted marks</button>}{isPublished && auth?.role === 'admin' && sheet && <button type="button" onClick={() => reopenSheet(sheet)} className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-[12px] font-bold text-rose-600">Reopen for correction</button>}</div></article>; })}</div>
          {!subjectValidation.length && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[13px] font-semibold text-amber-800">No subjects are assigned to this examination. Add subjects in the exam or Academic Setup before entering marks.</div>}
        </div>
      </section>
      <div id="student-performance-register"><Card title="Student performance register" subtitle={`${data.exam_title} • Every subject appears once • ${rows.length} students`}>
        {loading ? <div className="flex justify-center py-10 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <Table columns={[{label:'Rank'},{label:'Roll No'},{label:'Student'}, ...resultSubjects.map((subject) => ({ label: subject, align: 'center' })), {label:'Total'},{label:'Percentage'},{label:'Grade'},{label:'Result'}]}>
            {rows.map((r) => (
              <tr key={r.student_id || r.roll || r.name} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/35">
                <td className="py-4"><Badge color={r.rank<=3?'amber':'gray'}>#{r.rank}</Badge></td>
                <td className="py-3 text-[14px] text-[#666]">{r.roll}</td>
                <td className="py-3 text-[14px] font-bold text-slate-900">{r.name}</td>
                {resultSubjects.map((subject) => { const item = (r.subjects || []).find((entry) => entry.subject === subject); return <td key={subject} className="py-3 text-center"><p className="text-[13px] font-bold text-slate-800">{item ? (item.appearance_status && item.appearance_status !== 'Appeared' ? item.appearance_status : `${item.score}/${item.total_max}`) : '—'}</p>{item?.percent !== null && item?.percent !== undefined && <p className="text-[12px] text-slate-400">{item.percent}%</p>}</td>; })}
                <td className="py-3 text-[14px] font-bold text-indigo-700">{r.total} / {r.total_max}</td>
                <td className="py-3 text-[14px] font-semibold text-[#333]">{r.percent}%</td>
                <td className="py-3"><Badge color={r.result === 'Pass' ? 'green' : 'red'}>{r.grade}</Badge></td>
                <td className="py-3"><Badge color={r.result === 'Pass' ? 'green' : 'red'}>{r.result}</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={resultSubjects.length + 7} className="py-10 text-center text-[14px] text-[#999]">No marks have been submitted for this Class, Section and Exam yet.</td></tr>}
          </Table>
        )}
      </Card></div>
      </>}
      {!loading && !data?.selected && <div className="mt-5 rounded-3xl border border-dashed border-indigo-200 bg-gradient-to-br from-white to-indigo-50/50 py-14 text-center"><TrendingUp className="mx-auto mb-3 h-8 w-8 text-indigo-300" /><p className="text-[14px] font-semibold text-slate-600">Select a Class and Section to open its result intelligence.</p><p className="mt-1 text-[13px] text-slate-400">The summary is calculated only from marks saved in the system.</p></div>}
    </Layout>
  );
};

const assessmentKey = (item = {}) => typeof item === 'string' ? item : String(item.exam_id || item.assessment || item.id || item.title || '').trim();

const averageOf = (values) => {
  const valid = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10 : null;
};

const displayPercent = (value) => value === null || value === undefined ? '—' : `${value}%`;

const digitalGrade = (percent) => {
  if (percent === null || percent === undefined) return '—';
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B+';
  if (percent >= 60) return 'B';
  if (percent >= 50) return 'C';
  if (percent >= 40) return 'D';
  return 'E';
};

const scoreText = (item) => item ? (item.result && !['Pass', 'Fail'].includes(item.result) ? item.result : `${item.score}/${item.total_max}`) : '—';

const TraditionalReportCard = ({ data, subjects, subjectAssessment, subjectAverage }) => {
  const { student, summary } = data;
  const holistic = (data.holistic_observations || []).find((item) => item.exam_id === data.selected_exam_id && ['Recorded', 'Validated'].includes(item.status)) || {};
  const termRows = (title, keys, summative = false) => (
    <section className="report-section">
      <h3>{title}</h3>
      <table><thead><tr><th>Subjects</th>{summative ? <><th>Exam</th><th>FA average</th><th>Total</th><th>Grade</th><th>GPA</th></> : <><th>Participation</th><th>Written work</th><th>Project work</th><th>Slip test</th><th>Total</th><th>Grade</th></>}</tr></thead>
      <tbody>{subjects.map((subject) => { const item = subjectAssessment(subject, keys[keys.length - 1]); const avg = subjectAverage(subject, keys); return <tr key={`${title}-${subject}`}><td>{subject}</td>{summative ? <><td>{scoreText(item)}</td><td>{displayPercent(subjectAverage(subject, keys.slice(0, -1)))}</td><td>{displayPercent(avg)}</td><td>{digitalGrade(avg)}</td><td>{item?.grade_point ?? '—'}</td></> : <><td>—</td><td>—</td><td>—</td><td>—</td><td>{scoreText(item || subjectAssessment(subject, keys[0]))}</td><td>{digitalGrade(avg)}</td></>}</tr>; })}<tr className="total-row"><td>GRAND TOTAL</td><td colSpan={6}>{displayPercent(averageOf(subjects.map((subject) => subjectAverage(subject, keys))))}</td></tr></tbody></table>
    </section>
  );
  return <div id="report-card-print" className="report-paper">
    <style>{`
      .report-paper{max-width:920px;margin:0 auto 28px;background:#fff;border:3px solid #243b72;border-radius:18px;padding:22px;color:#17213a;box-shadow:0 18px 50px rgba(30,41,59,.12)}
      .report-head{display:grid;grid-template-columns:76px 1fr 76px;align-items:center;border-bottom:4px solid #243b72;padding-bottom:14px;text-align:center}.report-logo{height:62px;width:62px;border-radius:16px;background:#eef2ff;color:#4f46e5;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800}.report-head h1{font-size:25px;font-weight:900;letter-spacing:.04em}.report-head p{font-size:11px;color:#64748b;margin-top:4px}.report-year{font-size:11px;font-weight:800;color:#243b72}
      .student-strip{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;margin:16px 0;background:#edf3ff;border:1px solid #c7d2fe;border-radius:12px;padding:12px}.student-strip b{display:block;font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:3px}.student-strip span{font-size:12px;font-weight:800}
      .report-section{margin-top:16px;break-inside:avoid}.report-section h3{background:#243b72;color:#fff;text-align:center;border-radius:9px 9px 0 0;padding:9px;font-size:14px;font-weight:900}.report-section table{width:100%;border-collapse:collapse;font-size:10px}.report-section th,.report-section td{border:1px solid #94a3b8;padding:8px;text-align:center}.report-section th{background:#eef2ff;font-weight:800}.report-section td:first-child,.report-section th:first-child{text-align:left;font-weight:800}.total-row{background:#fff7d6;font-weight:900}
      .report-bottom{display:grid;grid-template-columns:1.1fr 1fr;gap:14px;margin-top:16px}.report-panel{border:1px solid #94a3b8;border-radius:12px;overflow:hidden}.report-panel h4{background:#243b72;color:white;text-align:center;padding:8px;font-size:12px;font-weight:900}.attendance-grid,.observations{display:grid;grid-template-columns:repeat(3,1fr);font-size:10px}.attendance-grid div,.observations div{padding:10px;border-right:1px solid #cbd5e1;text-align:center}.observations{grid-template-columns:repeat(2,1fr)}.observations div{border-bottom:1px solid #cbd5e1;text-align:left}.observations b{display:block;font-size:9px;color:#64748b}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:34px;text-align:center;font-size:10px;font-weight:800}.signatures div{border-top:1px solid #475569;padding-top:7px}
      @media print{body *{visibility:hidden!important}#report-card-print,#report-card-print *{visibility:visible!important}#report-card-print{position:absolute;left:0;top:0;width:100%;max-width:none;margin:0;box-shadow:none;border-radius:0}@page{size:A4 portrait;margin:8mm}}
    `}</style>
    <header className="report-head"><div className="report-logo">O</div><div><h1>ORISON MAIN CAMPUS</h1><p>STUDENT PROGRESS REPORT · FORMATIVE &amp; SUMMATIVE ASSESSMENTS</p></div><div className="report-year">AY {data.academic_year || '2026–27'}</div></header>
    <div className={`mt-3 rounded-lg border px-3 py-2 text-center text-[13px] font-bold uppercase tracking-wider ${data.verification_status === 'Published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>{data.verification_status || 'Result under verification'}</div>
    <div className="student-strip"><div><b>Student name</b><span>{student.name}</span></div><div><b>Admission no.</b><span>{student.admission_no || student.id}</span></div><div><b>Class / Section</b><span>{student.class_name} / {student.section}</span></div><div><b>Roll no.</b><span>{student.roll}</span></div></div>
    {(data.exams || []).map((exam) => termRows(exam.title, [assessmentKey(exam)], String(exam.assessment_type || '').toLowerCase().includes('summative')))}
    <div className="report-bottom"><div className="report-panel"><h4>ATTENDANCE</h4><div className="attendance-grid"><div><b>Working days</b><br/>{summary.attendance_total ?? '—'}</div><div><b>Days present</b><br/>{summary.attendance_present ?? '—'}</div><div><b>Attendance</b><br/>{displayPercent(summary.attendance_percent)}</div></div></div><div className="report-panel"><h4>HOLISTIC OBSERVATIONS</h4><div className="observations">{[['Punctuality', holistic.punctuality],['Uniform / Dress', holistic.uniform_dress],['Hair / Nails / Teeth', holistic.personal_hygiene],['General Health', holistic.general_health]].map(([label,value])=><div key={label}><b>{label}</b>{value || 'Not recorded'}</div>)}</div></div></div>
    <div className="signatures"><div>Class Teacher</div><div>Parent / Guardian</div><div>Head of Institution</div></div>
  </div>;
};

export const ReportCard = () => {
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolExams, setSchoolExams] = useState([]);
  const [structure, setStructure] = useState({ classes: [] });
  const [exporting, setExporting] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedReportExam, setSelectedReportExam] = useState('');
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [observationRecords, setObservationRecords] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingCard, setLoadingCard] = useState(false);
  useEffect(() => {
    Promise.all([api.get('/results'), api.get('/students'), api.get('/academic-structure'), api.get('/exams')])
      .then(([resultResponse, studentResponse, structureResponse, examResponse]) => { setGroups(resultResponse.data?.available_groups || []); setStudents(studentResponse.data || []); setStructure(structureResponse.data || { classes: [] }); setSchoolExams(examResponse.data || []); })
      .finally(() => setLoading(false));
  }, []);
  const classOptions = [...new Set([...(structure.classes || []).map((item) => item.name), ...groups.map((group) => group.class_name)].filter(Boolean))].sort();
  const selectedClassSetup = (structure.classes || []).find((item) => item.name === selectedClass);
  const sectionOptions = [...new Set([...(selectedClassSetup?.sections || []).map((item) => item.name), ...groups.filter((group) => group.class_name === selectedClass).map((group) => group.section)].filter(Boolean))].sort();
  const selectedSectionSetup = (selectedClassSetup?.sections || []).find((item) => item.name === selectedSection);
  const reportExam = schoolExams.find((exam) => exam.id === selectedReportExam);
  const reportDate = (reportExam?.papers || []).map((paper) => paper.date).filter(Boolean).sort()[0] || reportExam?.date || '';
  const filteredStudents = students.filter((student) => student.class_name === selectedClass && student.section === selectedSection && isActiveStudentOn(student, reportDate)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const availableReportExams = schoolExams.filter((exam) => exam.class_name === selectedClass && exam.section === selectedSection && exam.status !== 'Draft').filter((exam, index, list) => list.findIndex((item) => item.id === exam.id) === index);
  const chooseClass = (event) => { setSelectedClass(event.target.value); setSelectedSection(''); setSelectedStudent(''); setSelectedReportExam(''); setStudentsLoaded(false); setData(null); };
  const chooseSection = (event) => { setSelectedSection(event.target.value); setSelectedStudent(''); setSelectedReportExam(''); setStudentsLoaded(false); setData(null); };
  const chooseStudent = async (studentId) => {
    setSelectedStudent(studentId); setData(null);
    if (!studentId) return;
    setLoadingCard(true);
    try { const response = await api.get(`/report-card/${studentId}`); setData(response.data); }
    finally { setLoadingCard(false); }
  };
  const loadStudents = async () => {
    if (!selectedClass || !selectedSection || !selectedReportExam) return;
    setStudentsLoaded(true); setSelectedStudent(''); setData(null);
    try { const response = await api.get('/holistic-observations', { params: { class_name: selectedClass, section: selectedSection, exam_id: selectedReportExam } }); setObservationRecords(response.data || []); }
    catch { setObservationRecords([]); }
  };
  const student = data?.student;
  const marks = (data?.marks || []).filter((item) => !selectedReportExam || assessmentKey(item) === selectedReportExam);
  const summary = data?.summary;
  const keyedAssessments = marks.reduce((collection, item) => {
    const key = assessmentKey(item);
    if (!key) return collection;
    collection[key] = collection[key] || [];
    collection[key].push(item);
    return collection;
  }, {});
  const configuredSubjects = (selectedSectionSetup?.subjects || []).map((item) => typeof item === 'string' ? item : item.name).filter(Boolean);
  const allExams = (data?.exams || []).filter((exam, index, list) => list.findIndex((item) => assessmentKey(item) === assessmentKey(exam)) === index);
  const selectedExamDefinition = allExams.find((exam) => assessmentKey(exam) === selectedReportExam);
  const subjects = [...new Set([...(selectedExamDefinition?.subjects || []), ...marks.map((item) => item.subject).filter(Boolean)])].sort();
  const exams = allExams.filter((exam) => !selectedReportExam || assessmentKey(exam) === selectedReportExam);
  const examKeys = exams.map(assessmentKey);
  const subjectAssessment = (subject, key) => (keyedAssessments[key] || []).find((item) => item.subject === subject);
  const subjectAverage = (subject, keys) => averageOf(keys.map((key) => subjectAssessment(subject, key)?.percent));
  const assessmentCoverage = examKeys.filter((key) => keyedAssessments[key]?.length).length;
  const ungroupedMarks = marks.filter((item) => !examKeys.includes(assessmentKey(item)));
  const exportClassExamData = async () => {
    if (!selectedClass || !selectedSection || !filteredStudents.length) return;
    setExporting(true);
    try {
      const cards = await Promise.all(filteredStudents.map(async (item) => (await api.get(`/report-card/${item.id}`)).data));
      const rows = [];
      cards.forEach((card) => {
        const cardSubjects = [...new Set([...(card.configured_subjects || []), ...configuredSubjects, ...(card.marks || []).map((item) => item.subject).filter(Boolean)])].sort();
        const cardExams = (card.exams || []).filter((exam, index, list) => list.findIndex((item) => assessmentKey(item) === assessmentKey(exam)) === index);
        cardSubjects.forEach((subject) => cardExams.forEach((exam) => {
          const mark = (card.marks || []).find((item) => item.subject === subject && assessmentKey(item) === assessmentKey(exam));
          rows.push([card.student.admission_no || card.student.id, card.student.roll, card.student.name, card.student.class_name, card.student.section, exam.title, subject, mark?.score ?? '', mark?.total_max ?? '', mark?.percent ?? '', mark?.grade ?? '', mark?.grade_point ?? '', mark?.result ?? 'Pending', card.summary.attendance_total ?? '', card.summary.attendance_present ?? '', card.summary.attendance_percent ?? '']);
        }));
      });
      downloadCSV(`${selectedClass}-${selectedSection}-all-exam-data.csv`, ['Admission No','Roll No','Student','Class','Section','Exam','Subject','Marks','Maximum Marks','Percentage','Grade','Grade Point','Result','Working Days','Days Present','Attendance %'], rows);
    } finally { setExporting(false); }
  };
  const renderTerm = (title, subtitle, keys) => (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/60 px-5 py-4 sm:flex-row sm:items-center"><div><p className="text-[12px] font-bold uppercase tracking-[0.16em] text-indigo-500">Assessment record</p><h3 className="mt-1 font-poppins text-[17px] font-bold text-slate-900">{title}</h3><p className="mt-0.5 text-[12px] text-slate-400">{subtitle}</p></div><div className="flex gap-2">{keys.map((key) => <span key={key} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${keyedAssessments[key]?.length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{keyedAssessments[key]?.length ? `${key} recorded` : `${key} pending`}</span>)}</div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-slate-100 bg-white text-[12px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Subject</th>{keys.map((key) => <th key={key} className="px-4 py-3 text-center">{key}</th>)}<th className="px-4 py-3 text-center">Term progress</th><th className="px-5 py-3 text-right">Grade</th></tr></thead><tbody>{subjects.map((subject) => { const termAverage = subjectAverage(subject, keys); return <tr key={`${title}-${subject}`} className="border-b border-slate-100 last:border-0"><td className="px-5 py-3.5 text-[13px] font-bold text-slate-800">{subject}</td>{keys.map((key) => { const item = subjectAssessment(subject, key); return <td key={key} className="px-4 py-3.5 text-center"><p className={`text-[13px] font-bold ${item ? 'text-slate-800' : 'text-slate-300'}`}>{item ? `${item.score}/${item.total_max}` : '—'}</p>{item && <p className="mt-0.5 text-[12px] text-slate-400">{item.percent}%</p>}</td>; })}<td className="px-4 py-3.5"><div className="mx-auto h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${termAverage || 0}%` }} /></div><p className="mt-1 text-center text-[12px] font-semibold text-slate-500">{displayPercent(termAverage)}</p></td><td className="px-5 py-3.5 text-right"><Badge color={termAverage !== null && termAverage >= 40 ? 'green' : termAverage === null ? 'gray' : 'red'}>{digitalGrade(termAverage)}</Badge></td></tr>; })}{subjects.length === 0 && <tr><td colSpan={keys.length + 3} className="py-10 text-center text-[13px] text-slate-400">Assessment marks have not been entered yet.</td></tr>}</tbody></table></div>
    </div>
  );
  return (
    <Layout>
      <PageTitle title="Report Card" subtitle="The approved school design, built dynamically from school-created exams, subjects, attendance and verified records."
        actions={<><Btn variant="outline" icon={Download} disabled={!selectedSection || exporting} onClick={exportClassExamData}>{exporting ? 'Preparing CSV…' : 'Download Class CSV'}</Btn><Btn variant="outline" icon={Printer} disabled={!data || data.verification_status !== 'Published'} onClick={printPage}>Print</Btn><Btn icon={Download} disabled={!data || data.verification_status !== 'Published'} onClick={printPage}>Download PDF</Btn></>} />
      <Card title="Generate student report" subtitle="Choose Class, Section and Exam, then load the complete student list. Selecting one student is optional until you want to open that report card.">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-4">
          <select value={selectedClass} onChange={chooseClass} disabled={loading} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:opacity-50"><option value="">Select class</option>{classOptions.map((className) => <option key={className} value={className}>{className}</option>)}</select>
          <select value={selectedSection} onChange={chooseSection} disabled={!selectedClass} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:opacity-50"><option value="">Select section</option>{sectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}</select>
          <select value={selectedReportExam} onChange={(event) => { setSelectedReportExam(event.target.value); setSelectedStudent(''); setStudentsLoaded(false); setData(null); }} disabled={!selectedSection} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 outline-none shadow-sm focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:opacity-50"><option value="">Select exam</option>{availableReportExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select>
          <button type="button" disabled={!selectedClass || !selectedSection || !selectedReportExam} onClick={loadStudents} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-[13px] font-bold text-white shadow-[0_10px_22px_rgba(79,70,229,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><Users className="h-4 w-4" /> LOAD STUDENTS</button>
        </div>
      </Card>
      {studentsLoaded && <Card className="mb-5" title={`Students in ${selectedClass} — ${selectedSection}`} subtitle={`${filteredStudents.length} active student${filteredStudents.length === 1 ? '' : 's'} found. Open only the report card you need.`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredStudents.map((item) => { const observation = observationRecords.find((record) => record.student_id === item.id); return <div key={item.id} className={`rounded-2xl border p-4 transition hover:border-indigo-200 hover:shadow-md ${selectedStudent === item.id ? 'border-indigo-300 bg-indigo-50 ring-4 ring-indigo-50' : 'border-slate-100 bg-white'}`}><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 font-poppins text-[14px] font-bold text-indigo-700">{(item.name || 'S').slice(0, 1)}</span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold text-slate-900">{item.name}</p><p className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-slate-400">{item.roll ? `Roll ${item.roll}` : `Admission ${item.admission_no || item.id}`}</p></div><Badge color={['Recorded','Validated'].includes(observation?.status) ? 'green' : 'amber'}>{observation?.status || 'Not recorded'}</Badge></div><button type="button" onClick={() => chooseStudent(item.id)} className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-[12px] font-bold text-white">Open report</button></div>; })}{filteredStudents.length === 0 && <div className="col-span-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[13px] font-semibold text-amber-800">No active students are assigned to this Class and Section.</div>}</div>
      </Card>}
      {loadingCard && <div className="flex justify-center py-12 text-[#999]"><Loader2 className="h-7 w-7 animate-spin" /></div>}
      {data && selectedReportExam && !loadingCard && <TraditionalReportCard data={{ ...data, marks, exams, selected_exam_id: selectedReportExam }} subjects={subjects} subjectAssessment={subjectAssessment} subjectAverage={subjectAverage} />}
      {false && data && !loadingCard && <>
        <div className="mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-[0_24px_60px_rgba(49,46,129,0.24)]">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 font-poppins text-[23px] font-bold">{student.name?.slice(0, 1)}</div><div><div className="mb-1 flex items-center gap-2"><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wider text-emerald-200">Verified school record</span></div><h2 className="font-poppins text-[24px] font-bold tracking-[-0.03em]">{student.name}</h2><p className="mt-1 text-[13px] text-indigo-100/65">Admission No. {student.admission_no || student.id} · {student.class_name} / {student.section} · Roll {student.roll}</p></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[[Award,'Overall',`${summary.average_percent}%`],[BookOpen,'Assessments',`${assessmentCoverage}/6`],[Users,'Attendance',summary.attendance_percent === null ? '—' : `${summary.attendance_percent}%`],[Trophy,'Class rank',summary.class_rank ? `${summary.class_rank}/${summary.class_size}` : '—']].map(([Icon,label,value]) => <div key={label} className="min-w-[92px] rounded-2xl border border-white/10 bg-white/[0.08] p-3"><Icon className="mb-2 h-4 w-4 text-indigo-200" /><p className="font-poppins text-[17px] font-bold">{value}</p><p className="mt-0.5 text-[12px] font-bold uppercase tracking-wider text-indigo-100/50">{label}</p></div>)}</div></div>
        </div>
        <div className="space-y-5">
          {renderTerm('Term 1 · Learning foundation', 'FA1 + FA2 formative evidence followed by SA1 summative assessment', ['FA1','FA2','SA1'])}
          {renderTerm('Term 2 · Learning progression', 'FA3 + FA4 formative evidence followed by SA2 summative assessment', ['FA3','FA4','SA2'])}
          <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm"><div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white"><div><p className="text-[12px] font-bold uppercase tracking-[0.16em] text-indigo-100">Combined annual result</p><h3 className="mt-1 font-poppins text-[17px] font-bold">Whole-year scholastic summary</h3></div><Badge color={summary.result === 'Pass' ? 'green' : 'amber'}>{summary.result}</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-slate-100 text-[12px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Subject</th><th className="px-4 py-3 text-center">Term 1</th><th className="px-4 py-3 text-center">Term 2</th><th className="px-4 py-3 text-center">Annual performance</th><th className="px-4 py-3 text-center">Grade</th><th className="px-5 py-3 text-right">Status</th></tr></thead><tbody>{subjects.map((subject) => { const term1 = subjectAverage(subject,['FA1','FA2','SA1']); const term2 = subjectAverage(subject,['FA3','FA4','SA2']); const annual = averageOf([term1,term2]); return <tr key={`annual-${subject}`} className="border-b border-slate-100 last:border-0"><td className="px-5 py-3.5 text-[13px] font-bold text-slate-800">{subject}</td><td className="px-4 py-3.5 text-center text-[13px] font-semibold text-slate-600">{displayPercent(term1)}</td><td className="px-4 py-3.5 text-center text-[13px] font-semibold text-slate-600">{displayPercent(term2)}</td><td className="px-4 py-3.5 text-center text-[14px] font-bold text-indigo-600">{displayPercent(annual)}</td><td className="px-4 py-3.5 text-center"><Badge color={annual !== null && annual >= 40 ? 'green' : annual === null ? 'gray' : 'red'}>{digitalGrade(annual)}</Badge></td><td className="px-5 py-3.5 text-right text-[12px] font-bold text-slate-500">{annual === null ? 'Awaiting assessments' : annual >= 40 ? 'Progressing' : 'Needs support'}</td></tr>; })}</tbody></table></div></div>
          {ungroupedMarks.length > 0 && <Card title="Other assessments" subtitle="Saved examinations that are not labelled FA1–FA4 or SA1–SA2."><Table columns={[{label:'Assessment'},{label:'Subject'},{label:'Score'},{label:'Percentage'},{label:'Grade'}]}>{ungroupedMarks.map((item,index) => <tr key={`${item.assessment}-${item.subject}-${index}`} className="border-b border-slate-100 last:border-0"><td className="py-3 text-[13px] font-bold text-slate-800">{item.assessment}</td><td className="py-3 text-[13px] text-slate-600">{item.subject}</td><td className="py-3 text-[13px] font-semibold text-slate-700">{item.score}/{item.total_max}</td><td className="py-3 text-[13px] text-slate-600">{item.percent}%</td><td className="py-3"><Badge color={item.result === 'Pass' ? 'green' : 'red'}>{item.grade}</Badge></td></tr>)}</Table></Card>}
          <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Attendance record</p><h3 className="text-[15px] font-bold text-slate-900">{summary.attendance_percent === null ? 'Attendance not recorded' : `${summary.attendance_percent}% attendance`}</h3></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${summary.attendance_percent || 0}%` }} /></div><p className="mt-3 text-[13px] leading-5 text-slate-500">Calculated automatically from saved daily attendance. Monthly working-day details will appear when those records are available.</p></div><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Holistic observations</p><h3 className="text-[15px] font-bold text-slate-900">Behavioural record</h3></div></div><div className="mt-4 grid grid-cols-2 gap-2">{['Punctuality','Uniform & dress','Personal hygiene','General health'].map((label) => <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[12px] font-semibold text-slate-600">{label}</p><p className="mt-1 text-[12px] text-slate-400">Not recorded</p></div>)}</div></div></div>
          <div className="grid grid-cols-3 gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">{['Class Teacher','Parent / Guardian','Head of Institution'].map((label) => <div key={label} className="rounded-2xl border border-dashed border-slate-200 px-3 py-6"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-3 text-[12px] text-slate-300">Signature / verification</p></div>)}</div>
        </div>
      </>}
      {!loading && !studentsLoaded && <div className="mt-5 rounded-3xl border border-dashed border-indigo-200 bg-gradient-to-br from-white to-indigo-50/50 py-14 text-center"><GraduationCap className="mx-auto mb-3 h-8 w-8 text-indigo-300" /><p className="text-[14px] font-semibold text-slate-600">Select Class, Section and Exam, then load students.</p><p className="mt-1 text-[13px] text-slate-400">You do not need to select a student before loading the class list.</p></div>}
    </Layout>
  );
};
