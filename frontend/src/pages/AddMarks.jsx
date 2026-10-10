import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Download, Users, ClipboardList, Loader2, CheckCircle2, BookOpen, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import api from '../api';
import { downloadCSV } from '../utils';

const selectStyle = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60';

const AttendanceBadge = ({ status }) => {
  const display = status || 'Not marked';
  const color = display === 'Present' ? 'bg-green-50 text-green-700'
    : display === 'Absent' ? 'bg-indigo-50 text-indigo-700'
      : display === 'Late' ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-500';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>{display}</span>;
};

const AddMarks = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [meta, setMeta] = useState({ exam_id: '', class_name: '', section: '', exam_title: '', subject: '' });

  useEffect(() => {
    Promise.all([api.get('/exams'), api.get('/students')])
      .then(([examResponse, studentResponse]) => { setExams(examResponse.data || []); setStudents(studentResponse.data || []); })
      .catch(() => setNotice('Could not load scheduled exams or student records. Please restart the backend and try again.'))
      .finally(() => setLoading(false));
  }, []);

  const scheduledExams = useMemo(() => exams.filter((exam) => exam.status === 'Scheduled'), [exams]);
  const classOptions = useMemo(() => [...new Set(scheduledExams.map((exam) => exam.class_name).filter(Boolean))].sort(), [scheduledExams]);
  const sectionOptions = useMemo(() => [...new Set(scheduledExams.filter((exam) => exam.class_name === selectedClass).map((exam) => exam.section).filter(Boolean))].sort(), [scheduledExams, selectedClass]);
  const matchingExams = useMemo(() => scheduledExams.filter((exam) => exam.class_name === selectedClass && exam.section === selectedSection), [scheduledExams, selectedClass, selectedSection]);
  const selectedExam = useMemo(() => scheduledExams.find((exam) => exam.id === meta.exam_id), [scheduledExams, meta.exam_id]);
  const subjects = selectedExam ? (selectedExam.subjects?.length ? selectedExam.subjects : [selectedExam.subject]).filter((subject) => subject && subject !== 'All Subjects') : [];
  const maxMarks = Number(selectedExam?.max_marks || 100);
  const passMarks = Number(selectedExam?.passing_marks || 0);
  const performanceFor = (score) => {
    if (score === '') return { total: '—', percent: null, grade: '—', point: '—', result: 'Pending' };
    const total = Number(score || 0);
    const percent = maxMarks ? (total / maxMarks) * 100 : 0;
    const scheme = selectedExam?.grade_scheme || [];
    const match = scheme.find((item) => Number(item.from) <= percent && percent <= Number(item.to));
    const result = match?.result || (total >= passMarks ? 'Pass' : 'Fail');
    return { total, percent: Math.min(100, percent), grade: match?.grade || '—', point: match?.point ?? '—', result };
  };
  const enteredCount = rows.filter((row) => row.written !== '').length;
  const entryProgress = rows.length ? Math.round((enteredCount / rows.length) * 100) : 0;

  const chooseClass = (event) => {
    setSelectedClass(event.target.value); setSelectedSection(''); setMeta({ exam_id: '', class_name: '', section: '', exam_title: '', subject: '' }); setRows([]); setNotice('');
  };
  const chooseSection = (event) => {
    setSelectedSection(event.target.value); setMeta({ exam_id: '', class_name: '', section: '', exam_title: '', subject: '' }); setRows([]); setNotice('');
  };
  const chooseExam = (event) => {
    const exam = matchingExams.find((item) => item.id === event.target.value);
    setMeta({ exam_id: exam?.id || '', exam_title: exam?.title || '', class_name: exam?.class_name || '', section: exam?.section || '', subject: '' });
    setRows([]); setNotice('');
  };
  const loadList = async () => {
    if (!selectedExam || !meta.subject) { setNotice('Select a scheduled exam and one subject before loading the student list.'); return; }
    const matchingStudents = students.filter((student) => student.class_name === selectedExam.class_name && student.section === selectedExam.section && student.status !== 'Inactive');
    setLoadingRoster(true);
    try {
      const response = await api.get('/attendance/records', { params: { attendance_role: 'student', class_name: selectedExam.class_name, section: selectedExam.section } });
      const latestAttendance = {};
      (response.data || []).forEach((record) => {
        if (record.entity_id && latestAttendance[record.entity_id] === undefined) latestAttendance[record.entity_id] = record.status;
      });
      setRows(matchingStudents.map((student) => ({ student_id: student.id, roll: student.roll || student.admission_no || student.id, name: student.name, attendance: latestAttendance[student.id] || 'Not marked', written: '' })));
      setNotice(matchingStudents.length ? '' : `No active students are available in ${selectedExam.class_name} — ${selectedExam.section}.`);
    } catch {
      setRows(matchingStudents.map((student) => ({ student_id: student.id, roll: student.roll || student.admission_no || student.id, name: student.name, attendance: 'Not marked', written: '' })));
      setNotice('Students were loaded, but their attendance could not be read. Save attendance in Attendance Management and try again.');
    } finally {
      setLoadingRoster(false);
    }
  };
  const setRow = (index, key, value) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const exportList = () => downloadCSV('marks-entry-list.csv', ['Roll / Admission No', 'Student', 'Class', 'Section', 'Subject'], rows.map((row) => [row.roll, row.name, meta.class_name, meta.section, meta.subject]));

  const submit = async () => {
    if (!selectedExam || !meta.subject || !rows.length) { setNotice('Load a real class list before submitting marks.'); return; }
    if (rows.some((row) => row.written === '')) { setNotice('Enter marks for every student before finalising this result sheet.'); return; }
    if (rows.some((row) => Number(row.written) < 0 || Number(row.written) > maxMarks)) { setNotice(`Every score must be between 0 and ${maxMarks}.`); return; }
    setSaving(true);
    try {
      await api.post('/marks', {
        exam_id: selectedExam.id, exam_title: selectedExam.title, class_name: selectedExam.class_name, section: selectedExam.section, subject: meta.subject,
        max_written: maxMarks, max_practical: 0, passing_marks: passMarks, grade_scheme: selectedExam.grade_scheme || [],
        rows: rows.map((row) => ({ student_id: row.student_id, roll: row.roll, name: row.name, attendance: row.attendance, written: Number(row.written || 0), practical: 0 })),
      });
      navigate('/marks/results');
    } catch (error) {
      setNotice(error?.response?.data?.detail || 'Could not submit marks. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="font-poppins text-[26px] font-bold tracking-[-0.035em] text-slate-950">Add Marks</h1><p className="mt-1 text-[12px] text-slate-500">Choose the examination and Student List, then enter and validate scores.</p></div>{rows.length > 0 && <div className="min-w-[220px]"><div className="flex justify-between text-[10px] font-semibold text-slate-500"><span>Marks completion</span><span>{entryProgress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${entryProgress}%` }} /></div></div>}</div>

      {notice && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[12px] font-medium text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}
      {loading ? <div className="flex justify-center py-20 text-[#888]"><Loader2 className="h-7 w-7 animate-spin" /></div> : !scheduledExams.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-[14px] text-amber-800">There are no scheduled exams yet. Create and schedule an exam first, then return here to enter marks.</div> : <>
        <section className="mb-6 rounded-[26px] border border-white bg-white/95 p-6 shadow-[0_14px_38px_rgba(15,23,42,0.065)] ring-1 ring-slate-100">
          <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><BookOpen className="h-5 w-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-indigo-500">Step 1 · Examination context</p><h3 className="font-poppins text-[16px] font-bold text-slate-900">Select the exact result sheet</h3><p className="text-[11px] text-slate-400">Only exams already scheduled for the selected class and section will appear.</p></div></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-[10px] uppercase tracking-wide text-[#888]">Class<select className={`${selectStyle} mt-1.5`} value={selectedClass} onChange={chooseClass}><option value="">Select class</option>{classOptions.map((className) => <option key={className} value={className}>{className}</option>)}</select></label>
            <label className="text-[10px] uppercase tracking-wide text-[#888]">Section<select className={`${selectStyle} mt-1.5`} value={selectedSection} onChange={chooseSection} disabled={!selectedClass}><option value="">Select section</option>{sectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}</select></label>
            <label className="text-[10px] uppercase tracking-wide text-[#888]">Scheduled exam<select className={`${selectStyle} mt-1.5`} value={meta.exam_id} onChange={chooseExam} disabled={!selectedSection || !matchingExams.length}><option value="">Select exam</option>{matchingExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label>
            <label className="text-[10px] uppercase tracking-wide text-[#888]">Subject<select className={`${selectStyle} mt-1.5`} value={meta.subject} onChange={(event) => { setMeta((current) => ({ ...current, subject: event.target.value })); setRows([]); }} disabled={!selectedExam}><option value="">Select subject</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
            <div className="flex items-end"><button onClick={loadList} disabled={loadingRoster || !selectedExam || !meta.subject} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">{loadingRoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{loadingRoster ? 'LOADING STUDENT LIST' : 'LOAD STUDENT LIST'}</button></div>
          </div>
          {selectedClass && selectedSection && !matchingExams.length && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">Exams are not updated for <strong>{selectedClass} — {selectedSection}</strong>. Create and schedule an exam for this Class and Section first.</p>}
        </section>

        {selectedExam && <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-blue-600" /><div><p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Roster loaded</p><p className="font-poppins text-[20px] font-bold text-slate-900">{rows.length}</p></div></div></div><div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"><div className="flex items-center gap-3"><ClipboardList className="h-5 w-5 text-violet-600" /><div><p className="text-[9px] font-bold uppercase tracking-wide text-violet-500">Marks entered</p><p className="font-poppins text-[20px] font-bold text-slate-900">{enteredCount} / {rows.length}</p></div></div></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Maximum marks</p><p className="mt-1 font-poppins text-[20px] font-bold text-slate-900">{maxMarks}</p></div><div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Pass requirement</p><p className="mt-1 font-poppins text-[20px] font-bold text-slate-900">{passMarks || 'Not set'}</p></div></div>}

        <section className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[0_16px_42px_rgba(15,23,42,0.07)] ring-1 ring-slate-100"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-indigo-500">Step 2 · Score entry</p><h3 className="font-poppins text-[16px] font-bold text-slate-900">Student marks register</h3><p className="mt-1 text-[11px] text-slate-400">Attendance is read automatically. Blank scores remain pending and are never treated as failures.</p></div>{rows.length > 0 && <button onClick={exportList} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] font-bold text-slate-600 shadow-sm hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> Export roster</button>}</div><div className="overflow-x-auto">
          <div className="min-w-[940px]">
            <div className="grid grid-cols-[115px_1fr_120px_130px_100px_80px_105px_80px] gap-2 bg-slate-50/80 px-6 py-3.5 text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400"><span>Roll No</span><span>Student Name</span><span>Attendance</span><span>Score / {maxMarks}</span><span>Total / {maxMarks}</span><span>%</span><span>Grade / Point</span><span>Result</span></div>
            {rows.map((row, index) => {
              const performance = performanceFor(row.written);
              return <div key={row.student_id} className="grid grid-cols-[115px_1fr_120px_130px_100px_80px_105px_80px] items-center gap-2 border-b border-slate-100 px-6 py-4 transition hover:bg-indigo-50/25 last:border-0"><span className="text-[12px] font-semibold text-slate-500">{row.roll}</span><span className="text-[13px] font-bold text-slate-800">{row.name}</span><AttendanceBadge status={row.attendance} /><input value={row.written} onChange={(event) => setRow(index, 'written', event.target.value)} type="number" min="0" max={maxMarks} placeholder="Enter score" className="h-10 w-28 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-[12px] font-bold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50" /><span className="text-[13px] font-bold text-slate-800">{performance.total}</span><span className="text-[12px] font-semibold text-slate-600">{performance.percent === null ? '—' : `${performance.percent.toFixed(1)}%`}</span><span className="text-[12px] font-bold text-slate-700">{performance.grade} · {performance.point}</span><span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${performance.result === 'Pending' ? 'bg-slate-100 text-slate-500' : performance.result === 'Fail' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{performance.result}</span></div>;
            })}
          </div>
          {!rows.length && <div className="py-12 text-center text-[13px] text-[#999]">Select Class and Section, then choose the scheduled exam and subject to load students.</div>}
        </div></section>

        {rows.length > 0 && <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 sm:flex-row"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-indigo-600" /><div><p className="text-[12px] font-bold text-slate-800">Publish only after verification</p><p className="text-[10px] text-slate-500">All {rows.length} scores must be completed and within the permitted marks range.</p></div></div><button onClick={submit} disabled={saving || enteredCount !== rows.length} className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(79,70,229,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} FINALISE RESULT SHEET</button></div>}
      </>}
    </Layout>
  );
};

export default AddMarks;
