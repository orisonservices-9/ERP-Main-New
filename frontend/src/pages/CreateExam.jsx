import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { FileText, ListChecks, CalendarClock, Loader2, Plus, Trash2, CheckCircle2, ShieldCheck, BookOpen, AlertCircle } from 'lucide-react';
import api from '../api';

const Field = ({ label, hint, children }) => <label className="block text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500">{label}{hint && <span className="ml-2 normal-case tracking-normal text-slate-400">{hint}</span>}<div className="mt-2">{children}</div></label>;
const control = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60';

const CreateExam = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [structure, setStructure] = useState({ academic_year: '', classes: [] });
  const [gradeScheme, setGradeScheme] = useState([]);
  const [f, setF] = useState({ title: '', class_name: '', section: '', subject_mode: 'all', subject: '', date: '', room: '', start_time: '', end_time: '', max_marks: '100', passing_marks: '', assessment_component: 'Theory' });

  useEffect(() => {
    api.get('/academic-structure').then(({ data }) => setStructure(data || { academic_year: '', classes: [] })).catch(() => setStructure({ academic_year: '', classes: [] })).finally(() => setLoadingSetup(false));
  }, []);

  const selectedClass = useMemo(() => (structure.classes || []).find((item) => item.name === f.class_name), [structure, f.class_name]);
  const sections = useMemo(() => selectedClass?.sections || [], [selectedClass]);
  const selectedSection = useMemo(() => sections.find((item) => item.name === f.section), [sections, f.section]);
  const subjects = selectedSection?.subjects || [];
  const chosenSubjects = f.subject_mode === 'all' ? subjects : (f.subject ? [f.subject] : []);
  const set = (key) => (event) => setF((current) => ({ ...current, [key]: event.target.value }));
  const changeClass = (event) => setF((current) => ({ ...current, class_name: event.target.value, section: '', subject: '' }));
  const changeSection = (event) => setF((current) => ({ ...current, section: event.target.value, subject: '' }));
  const changeGrade = (index, key, value) => setGradeScheme((current) => current.map((item, row) => row === index ? { ...item, [key]: value } : item));
  const addGrade = () => setGradeScheme((current) => [...current, { grade: '', from: '', to: '', point: '', result: 'Pass' }]);
  const removeGrade = (index) => setGradeScheme((current) => current.filter((_, row) => row !== index));

  const readiness = [
    { label: 'Exam identity', ready: Boolean(f.title.trim()) },
    { label: 'Class, section and subjects', ready: Boolean(f.class_name && f.section && chosenSubjects.length) },
    { label: 'Date and time', ready: Boolean(f.date && f.start_time && f.end_time) },
    { label: 'Marks and pass rule', ready: Number(f.max_marks) > 0 && f.passing_marks !== '' && Number(f.passing_marks) >= 0 && Number(f.passing_marks) <= Number(f.max_marks) },
  ];
  const readinessCount = readiness.filter((item) => item.ready).length;
  const completion = Math.round((readinessCount / readiness.length) * 100);
  const sectionStyle = 'relative overflow-hidden rounded-3xl border border-white bg-white/95 p-6 shadow-[0_14px_38px_rgba(15,23,42,0.065)] ring-1 ring-slate-100';

  const schedule = async (status) => {
    if (!f.title.trim()) {
      alert('Enter an exam name before saving.');
      return;
    }
    if (status === 'Scheduled' && readinessCount !== readiness.length) {
      alert('Complete the assignment, schedule, and marks rules before scheduling this exam. You can save it as a draft until then.');
      return;
    }
    if (f.start_time && f.end_time && f.start_time >= f.end_time) { alert('End time must be later than the start time.'); return; }
    const invalidGrade = gradeScheme.some((item) => !item.grade.trim() || item.from === '' || item.to === '' || Number(item.from) < 0 || Number(item.to) > 100 || Number(item.from) > Number(item.to));
    if (invalidGrade) { alert('Complete every grade range and keep each range between 0 and 100.'); return; }
    setSaving(true);
    try {
      await api.post('/exams', {
        title: f.title.trim(), class_name: f.class_name, section: f.section,
        subject: f.subject_mode === 'all' ? 'All Subjects' : f.subject,
        subjects: chosenSubjects, date: f.date, room: f.room, start_time: f.start_time, end_time: f.end_time,
        max_marks: Number(f.max_marks) || 100, passing_marks: Number(f.passing_marks) || 0,
        assessment_component: f.assessment_component,
        grade_scheme: gradeScheme.map((item) => ({ ...item, from: Number(item.from), to: Number(item.to), point: item.point === '' ? null : Number(item.point) })), status,
      });
      navigate('/exams/view');
    } catch (error) {
      alert(error?.response?.data?.detail || 'Could not save the examination. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="font-poppins text-[26px] font-bold tracking-[-0.035em] text-slate-950">Create Examination</h1><p className="mt-1 text-[12px] text-slate-500">Assign learners and subjects, set the schedule, then review before publishing.</p></div><div className="min-w-[220px]"><div className="flex justify-between text-[10px] font-semibold text-slate-500"><span>Setup readiness</span><span>{readinessCount}/{readiness.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${completion}%` }} /></div></div></div>

      {loadingSetup ? <div className="flex justify-center py-20 text-[#888]"><Loader2 className="h-7 w-7 animate-spin" /></div> : !structure.classes?.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-[14px] text-amber-800">Please complete <strong>Academic Setup</strong> first. Add the Academic Year, Class, Section and Subjects, then return here to create an exam.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6 lg:col-span-2">
            <section className={sectionStyle}>
              <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 translate-x-10 -translate-y-10 rounded-full bg-indigo-50" /><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><FileText className="h-4 w-4" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-indigo-500">Step 1</p><h3 className="font-poppins text-[16px] font-bold text-slate-900">Exam assignment</h3><p className="text-[11px] text-slate-400">Choose exactly who will take this examination.</p></div></div>
              <div className="mb-5"><Field label="Exam Name"><input className={control} placeholder="e.g., Term 1 Examination" value={f.title} onChange={set('title')} /></Field></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Class"><select className={control} value={f.class_name} onChange={changeClass}><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></Field>
                <Field label="Section"><select className={control} value={f.section} onChange={changeSection} disabled={!f.class_name}><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></Field>
              </div>
              <div className="mt-5"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#777]">Subjects</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setF((current) => ({ ...current, subject_mode: 'all' }))} disabled={!f.section} className={`rounded-2xl border p-4 text-left transition ${f.subject_mode === 'all' ? 'border-indigo-300 bg-indigo-50 ring-4 ring-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'} disabled:opacity-50`}><span className="flex items-center gap-2 text-[13px] font-bold text-slate-800"><BookOpen className="h-4 w-4 text-indigo-500" /> All assigned subjects</span><span className="mt-1 block text-[10px] text-slate-400">Schedule one exam covering all {subjects.length} subjects</span></button>
                  <button type="button" onClick={() => setF((current) => ({ ...current, subject_mode: 'single' }))} disabled={!f.section} className={`rounded-2xl border p-4 text-left transition ${f.subject_mode === 'single' ? 'border-indigo-300 bg-indigo-50 ring-4 ring-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'} disabled:opacity-50`}><span className="flex items-center gap-2 text-[13px] font-bold text-slate-800"><FileText className="h-4 w-4 text-violet-500" /> One subject only</span><span className="mt-1 block text-[10px] text-slate-400">Create a focused subject examination</span></button>
                  {f.subject_mode === 'single' && <select className={`${control} max-w-xs`} value={f.subject} onChange={set('subject')}><option value="">Select subject</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>}
                </div>
                {f.section && !subjects.length && <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-[11px] font-medium text-amber-700"><AlertCircle className="h-4 w-4" /> No subjects are configured for this Class and Section. Add them in Academic Setup.</p>}
                {f.section && chosenSubjects.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{chosenSubjects.map((subject) => <span key={subject} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-700">{subject}</span>)}</div>}
              </div>
            </section>

            <section className={sectionStyle}>
              <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarClock className="h-4 w-4" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-blue-500">Step 2</p><h3 className="font-poppins text-[16px] font-bold text-slate-900">Schedule and venue</h3><p className="text-[11px] text-slate-400">Prevent clashes with a complete exam window.</p></div></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Exam Date"><input className={control} type="date" value={f.date} onChange={set('date')} /></Field><Field label="Hall / Room Number"><input className={control} placeholder="e.g., Room 101" value={f.room} onChange={set('room')} /></Field><Field label="Start Time"><input className={control} type="time" value={f.start_time} onChange={set('start_time')} /></Field><Field label="End Time"><input className={control} type="time" value={f.end_time} onChange={set('end_time')} /></Field></div>
            </section>

            <section className={sectionStyle}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><ListChecks className="h-4 w-4" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-violet-500">Step 3</p><h3 className="font-poppins text-[16px] font-bold text-slate-900">Assessment and grading</h3><p className="text-[11px] text-slate-400">Set the examination type, marks and result rules.</p></div></div><button type="button" onClick={addGrade} className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-600"><Plus className="h-3.5 w-3.5" /> Add grade</button></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Field label="Assessment Component"><select className={control} value={f.assessment_component} onChange={set('assessment_component')}><option value="Theory">Theory / Written</option><option value="Practical">Practical</option><option value="Internal">Internal Assessment</option><option value="Combined">Combined (Internal + Practical)</option></select></Field><Field label="Maximum Marks"><input className={control} type="number" min="1" value={f.max_marks} onChange={set('max_marks')} /></Field><Field label="Pass Marks"><input className={control} type="number" min="0" placeholder="School pass mark" value={f.passing_marks} onChange={set('passing_marks')} /></Field></div>
              <p className="mt-4 text-[12px] text-[#777]">Grade ranges are fully editable for this exam. Add only the grades your school uses, then set the mark range, grade point and Pass/Fail result.</p>
              {gradeScheme.length ? <><div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full min-w-[680px] text-left"><thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-[#888]"><tr><th className="px-3 py-3">Grade</th><th className="px-3 py-3">From %</th><th className="px-3 py-3">To %</th><th className="px-3 py-3">Grade Point</th><th className="px-3 py-3">Result</th><th className="px-3 py-3" /></tr></thead><tbody>{gradeScheme.map((item, index) => <tr key={index} className="border-t border-gray-100"><td className="p-2"><input className="h-9 w-full rounded border border-gray-200 px-2 text-[13px]" placeholder="A+" value={item.grade} onChange={(event) => changeGrade(index, 'grade', event.target.value)} /></td><td className="p-2"><input className="h-9 w-full rounded border border-gray-200 px-2 text-[13px]" type="number" min="0" max="100" placeholder="95" value={item.from} onChange={(event) => changeGrade(index, 'from', event.target.value)} /></td><td className="p-2"><input className="h-9 w-full rounded border border-gray-200 px-2 text-[13px]" type="number" min="0" max="100" placeholder="100" value={item.to} onChange={(event) => changeGrade(index, 'to', event.target.value)} /></td><td className="p-2"><input className="h-9 w-full rounded border border-gray-200 px-2 text-[13px]" type="number" min="0" step="0.1" placeholder="10" value={item.point} onChange={(event) => changeGrade(index, 'point', event.target.value)} /></td><td className="p-2"><select className="h-9 w-full rounded border border-gray-200 px-2 text-[13px]" value={item.result} onChange={(event) => changeGrade(index, 'result', event.target.value)}><option>Pass</option><option>Fail</option></select></td><td className="p-2 text-right"><button type="button" onClick={() => removeGrade(index)} className="rounded p-2 text-indigo-600 hover:bg-indigo-50"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><button type="button" onClick={addGrade} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#4338CA]"><Plus className="h-4 w-4" /> Add Another Grade</button></> : <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-[13px] text-[#888]">No grade ranges added yet. Click <strong>Add Grade Range</strong> to create your school’s grading scale.</div>}
            </section>
          </div>

          <aside className="sticky top-5 space-y-4 self-start">
            <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]"><div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-indigo-100">Final review</p><h3 className="mt-1 font-poppins text-[17px] font-bold">Exam readiness</h3></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 font-poppins text-[18px] font-bold">{completion}%</span></div></div>
              <div className="p-5"><div className="space-y-3">{readiness.map((item) => <div key={item.label} className="flex items-center gap-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${item.ready ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>{item.ready ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className={`text-[11px] font-semibold ${item.ready ? 'text-slate-700' : 'text-slate-400'}`}>{item.label}</span></div>)}</div>
                <div className="my-5 h-px bg-slate-100" /><div className="space-y-3 text-[11px]"><div className="flex justify-between gap-3"><span className="text-slate-400">Academic year</span><strong className="text-slate-700">{structure.academic_year || 'Not set'}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Assigned group</span><strong className="text-right text-slate-700">{f.class_name && f.section ? `${f.class_name} · ${f.section}` : 'Not selected'}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Subjects</span><strong className="text-slate-700">{chosenSubjects.length || '—'}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Assessment</span><strong className="text-right text-slate-700">{f.assessment_component}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-400">Marks rule</span><strong className="text-slate-700">{f.passing_marks || '—'} / {f.max_marks || '—'}</strong></div></div>
              </div>
            </div>
            <button onClick={() => schedule('Scheduled')} disabled={saving || readinessCount !== readiness.length} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 py-4 text-[13px] font-bold text-white shadow-[0_14px_28px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(79,70,229,0.36)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Review & schedule exam</button>
            <button onClick={() => schedule('Draft')} disabled={saving || !f.title.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-[12px] font-bold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-45"><FileText className="h-4 w-4" /> Save unfinished draft</button>
            <p className="px-3 text-center text-[10px] leading-4 text-slate-400">Scheduled exams are visible in View Exams immediately. Incomplete setups can safely remain as drafts.</p>
          </aside>
        </div>
      )}
    </Layout>
  );
};

export default CreateExam;
