import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { Card, PageTitle, Btn, Badge } from '../../components/Shared';
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, GraduationCap, Layers, Link2, LockKeyhole, Pencil, Plus, Save, ShieldAlert, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const makeId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tidyClass = (value) => value.trim().replace(/\s+/g, ' ').replace(/^(class|grade)\s*(.+)$/i, (_, prefix, rest) => `${prefix[0].toUpperCase() + prefix.slice(1).toLowerCase()} ${rest.toUpperCase()}`);
const tidySection = (value) => value.trim().replace(/^section\s*/i, '').replace(/\s+/g, ' ').toUpperCase();
const tidySubject = (value) => value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const weekDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export default function AcademicStructure() {
  const { auth } = useAuth();
  const [structure, setStructure] = useState({ academic_year: '', board: '', terms: [], working_days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], grading_scale: '', classes: [] });
  const [year, setYear] = useState('');
  const [className, setClassName] = useState('');
  const [sectionClassId, setSectionClassId] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [target, setTarget] = useState({ classId: '', section: '' });
  const [subject, setSubject] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [showYearWarning, setShowYearWarning] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [termsText, setTermsText] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [removeItem, setRemoveItem] = useState(null);
  const [impact, setImpact] = useState(null);
  const [setupStep, setSetupStep] = useState(1);
  const canEdit = ['admin', 'director'].includes(auth?.role);

  const load = async () => {
    setLoading(true);
    try {
      const [setup, request] = await Promise.all([api.get('/academic-structure'), api.get('/academic-year-change-request')]);
      setStructure({ academic_year: setup.data.academic_year || '', board: setup.data.board || '', terms: setup.data.terms || [], working_days: setup.data.working_days || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], grading_scale: setup.data.grading_scale || '', classes: setup.data.classes || [] });
      setTermsText((setup.data.terms || []).join(', '));
      setYear(setup.data.academic_year || '');
      setPendingRequest(request.data || null);
    } catch (_) { setNotice('Could not load saved setup. Please check the backend connection.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const sectionCount = useMemo(() => structure.classes.reduce((total, item) => total + item.sections.length, 0), [structure]);
  const subjectCount = useMemo(() => new Set(structure.classes.flatMap((item) => item.sections.flatMap((section) => section.subjects))).size, [structure]);
  const save = async (next = structure) => {
    if (!year.trim()) { setNotice('Enter an Academic Year first, for example 2026–2027.'); return false; }
    setSaving(true);
    try {
      const payload = { ...next, academic_year: structure.academic_year || year.trim(), terms: termsText.split(',').map((item) => item.trim()).filter(Boolean) };
      const { data } = await api.put('/academic-structure', payload);
      setStructure(data); setTermsText((data.terms || []).join(', ')); setYear(data.academic_year); setNotice('Academic setup saved successfully.'); return true;
    } catch (err) { setNotice(err.response?.data?.detail || 'Could not save the academic setup.'); return false; }
    finally { setSaving(false); }
  };
  const setFirstYear = () => save();
  const addClass = async () => {
    const name = tidyClass(className);
    if (!name) { setNotice('Enter a class name.'); return; }
    if (structure.classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) { setNotice('This class already exists.'); return; }
    const next = { ...structure, classes: [...structure.classes, { id: makeId(), name, sections: [] }] };
    setStructure(next); setClassName(''); await save(next);
  };
  const addSection = async () => {
    const cleanSection = tidySection(sectionName);
    if (!sectionClassId || !cleanSection) { setNotice('Select a class and enter a section name.'); return; }
    const next = { ...structure, classes: structure.classes.map((item) => item.id !== sectionClassId ? item : { ...item, sections: item.sections.some((x) => x.name.toLowerCase() === cleanSection.toLowerCase()) ? item.sections : [...item.sections, { name: cleanSection, subjects: [] }] }) };
    setStructure(next); setSectionName(''); await save(next);
  };
  const addSubjects = async () => {
    if (!target.classId || !target.section) { setNotice('Select a class and section first.'); return; }
    const requested = [...selectedSubjects, tidySubject(subject)].filter(Boolean);
    if (!requested.length) { setNotice('Select an existing subject or enter a new subject.'); return; }
    const next = { ...structure, classes: structure.classes.map((item) => item.id !== target.classId ? item : { ...item, sections: item.sections.map((section) => { if (section.name !== target.section) return section; const existing = new Set(section.subjects.map((name) => name.toLowerCase())); const additions = requested.filter((name) => !existing.has(name.toLowerCase())); return { ...section, subjects: [...section.subjects, ...additions] }; }) }) };
    setStructure(next); setSubject(''); setSelectedSubjects([]); await save(next);
  };
  const askRemove = async (item) => {
    setRemoveItem(item); setImpact(null);
    try { const { data } = await api.get('/academic-structure/impact', { params: { class_name: item.className, section: item.section || '', subject: item.subject || '' } }); setImpact(data); }
    catch (_) { setImpact({ total_connections: 0 }); }
  };
  const confirmRemove = async () => {
    if (!removeItem) return;
    let next = structure;
    if (removeItem.type === 'class') next = { ...structure, classes: structure.classes.filter((item) => item.id !== removeItem.classId) };
    if (removeItem.type === 'section') next = { ...structure, classes: structure.classes.map((item) => item.id !== removeItem.classId ? item : { ...item, sections: item.sections.filter((section) => section.name !== removeItem.section) }) };
    if (removeItem.type === 'subject') next = { ...structure, classes: structure.classes.map((item) => item.id !== removeItem.classId ? item : { ...item, sections: item.sections.map((section) => section.name !== removeItem.section ? section : { ...section, subjects: section.subjects.filter((name) => name !== removeItem.subject) }) }) };
    setRemoveItem(null); setStructure(next); await save(next);
  };
  const saveEdit = async () => {
    const value = editItem.type === 'class' ? tidyClass(editItem.value) : editItem.type === 'section' ? tidySection(editItem.value) : tidySubject(editItem.value);
    if (!value) return;
    const classItem = structure.classes.find((item) => item.id === editItem.classId);
    try {
      await api.post('/academic-structure/rename', { type: editItem.type, class_name: classItem?.name, section: editItem.section || '', subject: editItem.subject || '', new_name: value });
      setEditItem(null); setNotice('Name updated across Academic Setup and all connected records.'); await load();
    } catch (err) { setNotice(err.response?.data?.detail || 'Could not rename this item.'); }
  };
  const requestYearChange = async () => {
    try { await api.post('/academic-year-change-request', { academic_year: year.trim() }); setShowYearWarning(false); setNotice('Change request sent. The approval code has been sent to the Principal and Director.'); await load(); }
    catch (err) { setNotice(err.response?.data?.detail || 'Could not submit the change request.'); }
  };
  const confirmYearChange = async () => {
    try { await api.post(`/academic-year-change-request/${pendingRequest.id}/confirm`, { otp }); setOtp(''); setNotice('Academic Year change confirmed and applied.'); await load(); }
    catch (err) { setNotice(err.response?.data?.detail || 'Could not confirm this change.'); }
  };
  const targetClass = structure.classes.find((item) => item.id === target.classId);
  const targetSection = targetClass?.sections.find((item) => item.name === target.section);
  const suggestedSubjects = [...new Set((targetClass?.sections || []).filter((item) => item.name !== target.section).flatMap((item) => item.subjects || []))].filter((name) => !(targetSection?.subjects || []).some((current) => current.toLowerCase() === name.toLowerCase()));
  const toggleSuggestedSubject = (name) => setSelectedSubjects((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const success = notice.includes('successfully') || notice.includes('sent') || notice.includes('approved');

  return <Layout>
    <PageTitle title="Academic Setup" subtitle="Build the school’s academic foundation once. Admissions, students, teachers, curriculum, timetable and exams use this structure automatically." actions={canEdit && <Btn icon={Save} onClick={() => save()}>{saving ? 'Saving…' : 'Save Setup'}</Btn>} />
    {!canEdit && <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-700"><ShieldAlert className="h-4 w-4" /><span>You have view-only access. Admin or Director approval is required to change the academic structure.</span></div>}
    {notice && <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-[14px] ${success ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    {loading ? <div className="py-24 text-center text-[#888]">Loading academic setup…</div> : <>
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-4">{[{ label: 'Academic Year', value: structure.academic_year || 'Not set', icon: CalendarDays }, { label: 'Classes', value: structure.classes.length, icon: GraduationCap }, { label: 'Sections', value: sectionCount, icon: Layers }, { label: 'Unique Subjects', value: subjectCount, icon: BookOpen }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[#4F46E5]" /><p className="mt-4 font-poppins text-[22px] font-bold text-[#1a1a1a]">{value}</p><p className="text-[14px] text-[#888]">{label}</p></div>)}</div>
      <Card className="mb-6" title="School Academic Foundation" subtitle="These settings describe how the school organises the year. They are shared with planning and reporting.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-[13px] font-semibold text-slate-600">Board / Curriculum<input disabled={!canEdit} value={structure.board || ''} onChange={(e) => setStructure({ ...structure, board: e.target.value })} placeholder="CBSE / ICSE / State Board" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] disabled:bg-slate-50" /></label>
          <label className="text-[13px] font-semibold text-slate-600">Terms / Semesters<input disabled={!canEdit} value={termsText} onChange={(e) => setTermsText(e.target.value)} placeholder="Term 1, Term 2" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] disabled:bg-slate-50" /></label>
          <div><p className="text-[13px] font-semibold text-slate-600">Working Days</p><div className="mt-2 flex flex-wrap gap-1.5">{weekDays.map((day) => <button disabled={!canEdit} key={day} onClick={() => setStructure({ ...structure, working_days: (structure.working_days || []).includes(day) ? structure.working_days.filter((item) => item !== day) : [...(structure.working_days || []), day] })} className={`rounded-lg border px-2 py-2 text-[12px] font-bold disabled:opacity-60 ${(structure.working_days || []).includes(day) ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400'}`}>{day.slice(0,3)}</button>)}</div></div>
        </div>
      </Card>
      {showYearWarning && <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-[#4F46E5]" /><div className="w-full"><h3 className="font-semibold text-[#9f1016]">Change Academic Year?</h3><p className="mt-1 text-[14px] text-[#7a3033]">Changing the Academic Year affects all future admissions, class setup, curriculum planning, teacher allocation and reports. Historical records stay preserved.</p><label className="mt-4 block text-[13px] font-medium text-[#7a3033]">New Academic Year<input autoFocus value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2027–2028" className="mt-1 block h-11 w-full max-w-md rounded-lg border border-indigo-200 bg-white px-3 text-[14px]" /></label><p className="mt-2 text-[13px] text-[#7a3033]">Are you sure you want to send this request to the Principal or Director?</p><div className="mt-4 flex gap-3"><Btn onClick={requestYearChange} disabled={!year.trim()}>Yes, request approval</Btn><Btn variant="outline" onClick={() => { setYear(structure.academic_year); setShowYearWarning(false); }}>Cancel</Btn></div></div></div></div>}
      {pendingRequest && <section className="mb-6 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-[0_18px_45px_-28px_rgba(79,70,229,0.5)]"><div className="flex flex-col gap-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 p-6 text-white md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><LockKeyhole className="h-6 w-6" /></span><div><p className="text-[12px] font-bold uppercase tracking-[0.22em] text-indigo-200">Protected year transition</p><h3 className="mt-1 text-xl font-bold">{pendingRequest.current_year} <span className="text-indigo-300">→</span> {pendingRequest.requested_year}</h3></div></div><Badge color="amber">Leadership approval pending</Badge></div><div className="p-6"><div className="relative grid grid-cols-2 gap-3 md:grid-cols-4">{['Request raised','Director approval','Admin confirmation','Year activated'].map((label,index)=><div key={label} className={`relative z-10 rounded-2xl border p-4 ${index===0?'border-indigo-200 bg-indigo-50':'border-slate-100 bg-slate-50'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${index===0?'bg-indigo-600 text-white':'bg-white text-slate-400 shadow-sm'}`}>{index+1}</span><p className={`mt-3 text-[13px] font-bold ${index===0?'text-indigo-700':'text-slate-500'}`}>{label}</p></div>)}</div><div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><p className="max-w-xl text-[13px] leading-5 text-slate-500">The current year remains active until the Director approves the request and the Admin confirms it. No historic school records are changed.</p>{auth?.role === 'director' ? <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">Approval code: <strong className="ml-1 tracking-widest text-indigo-600">{pendingRequest.otp}</strong></div> : auth?.role === 'admin' ? <div className="flex max-w-md gap-2"><input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Director approval code" className="h-10 min-w-0 rounded-xl border border-slate-200 px-3 text-[13px]" /><Btn icon={LockKeyhole} onClick={confirmYearChange}>Confirm & apply</Btn></div> : null}</div></div></section>}
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[
        { step: 1, label: 'Academic Year', text: 'Set or request a protected year change.', icon: CalendarDays, tone: 'from-indigo-500 to-violet-500' },
        { step: 2, label: 'Add Class', text: 'Create the grades your school offers.', icon: GraduationCap, tone: 'from-rose-500 to-orange-400' },
        { step: 3, label: 'Add Section', text: 'Organise every class into sections.', icon: Layers, tone: 'from-cyan-500 to-blue-500' },
        { step: 4, label: 'Assign Subjects', text: 'Connect the right subjects in seconds.', icon: BookOpen, tone: 'from-emerald-500 to-teal-500' }
      ].map(({ step, label, text, icon: Icon, tone }) => <button key={step} onClick={() => setSetupStep(step)} className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${setupStep===step?'border-indigo-200 bg-white shadow-[0_16px_35px_-24px_rgba(79,70,229,0.65)] ring-2 ring-indigo-100':'border-slate-100 bg-white hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md'}`}><span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-lg`}><Icon className="h-5 w-5" /></span><span className="absolute right-4 top-4 text-[12px] font-extrabold tracking-[0.18em] text-slate-300">STEP 0{step}</span><h3 className="mt-4 text-[14px] font-bold text-slate-900">{label}</h3><p className="mt-1 text-[13px] leading-5 text-slate-500">{text}</p>{setupStep===step&&<span className="absolute inset-x-5 bottom-0 h-1 rounded-t-full bg-gradient-to-r from-indigo-500 to-violet-500" />}</button>)}</div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="xl:col-span-1">
        {setupStep===1&&<Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70" title="Academic Year" subtitle={structure.academic_year ? 'Protected after setup. Any change requires approval.' : 'Set this before creating classes.'}><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><CalendarDays className="h-7 w-7" /></div><div className="flex flex-col gap-3"><input value={year} disabled={Boolean(structure.academic_year)||!canEdit} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026–2027" className="h-12 min-w-0 flex-1 rounded-xl border border-indigo-100 bg-white px-4 text-[14px] disabled:bg-slate-50 disabled:text-slate-500" />{structure.academic_year ? <Btn variant="outline" disabled={auth?.role!=='admin'} onClick={() => { setYear(''); setShowYearWarning(true); }}>Request year change</Btn> : <Btn disabled={!canEdit} onClick={setFirstYear}>Set Academic Year</Btn>}</div>{structure.academic_year && <p className="mt-4 rounded-xl bg-white/80 p-3 text-[13px] leading-5 text-slate-500">{auth?.role==='admin'?'A protected approval request will be sent to the Director.':'Only Admin can request a year change.'}</p>}</Card>}
        {setupStep===2&&<Card className="border-orange-100 bg-gradient-to-br from-white to-orange-50/70" title="Add Class" subtitle="Names are automatically standardised for consistent reports."><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-lg shadow-orange-200"><GraduationCap className="h-7 w-7" /></div><div className="space-y-3"><input disabled={!canEdit} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class, e.g. Class 1" className="h-12 w-full rounded-xl border border-orange-100 bg-white px-4 text-[14px] disabled:bg-slate-50" /><Btn icon={Plus} onClick={addClass} disabled={!canEdit}>Add Class</Btn></div></Card>}
        {setupStep===3&&<Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/70" title="Add Section" subtitle="Choose a class and create its section."><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg shadow-blue-200"><Layers className="h-7 w-7" /></div><div className="space-y-3"><select disabled={!canEdit} value={sectionClassId} onChange={(e) => setSectionClassId(e.target.value)} className="h-12 w-full rounded-xl border border-blue-100 bg-white px-4 text-[14px] disabled:bg-slate-50"><option value="">Select class</option>{structure.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input disabled={!canEdit} value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="Section, e.g. A" className="h-12 w-full rounded-xl border border-blue-100 bg-white px-4 text-[14px] disabled:bg-slate-50" /><Btn icon={Plus} onClick={addSection} disabled={!canEdit}>Add Section</Btn></div></Card>}
        {setupStep===4&&<Card className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70" title="Assign Subjects" subtitle="Reuse subjects from another section or add a new one."><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200"><BookOpen className="h-7 w-7" /></div><div className="space-y-3"><select disabled={!canEdit} value={target.classId} onChange={(e) => { setTarget({ classId: e.target.value, section: '' }); setSelectedSubjects([]); setSubject(''); }} className="h-12 w-full rounded-xl border border-emerald-100 bg-white px-4 text-[14px]"><option value="">Select class</option>{structure.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={target.section} onChange={(e) => { setTarget({ ...target, section: e.target.value }); setSelectedSubjects([]); setSubject(''); }} className="h-12 w-full rounded-xl border border-emerald-100 bg-white px-4 text-[14px]" disabled={!targetClass||!canEdit}><option value="">Select section</option>{targetClass?.sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>{target.section&&<div className="rounded-xl border border-emerald-100 bg-white/80 p-3"><div className="flex items-center justify-between gap-2"><p className="text-[13px] font-semibold text-slate-600">Suggested from other sections</p>{suggestedSubjects.length>0&&<button onClick={()=>setSelectedSubjects(selectedSubjects.length===suggestedSubjects.length?[]:[...suggestedSubjects])} className="text-[12px] font-bold text-emerald-700">{selectedSubjects.length===suggestedSubjects.length?'Clear all':'Select all'}</button>}</div><div className="mt-2 flex flex-wrap gap-2">{suggestedSubjects.length?suggestedSubjects.map(name=><button key={name} onClick={()=>toggleSuggestedSubject(name)} className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${selectedSubjects.includes(name)?'border-emerald-300 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-500'}`}>{name}</button>):<span className="text-[12px] text-slate-400">No new suggestions available</span>}</div></div>}<input disabled={!canEdit} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New subject, e.g. Computer Science" className="h-12 w-full rounded-xl border border-emerald-100 bg-white px-4 text-[14px]" /><Btn icon={Plus} onClick={addSubjects} disabled={!canEdit}>Assign {selectedSubjects.length>1?`${selectedSubjects.length} Subjects`:'Subjects'}</Btn></div></Card>}
      </div>
      <Card title="Your Academic Structure" subtitle="This structure controls admissions, student import, curriculum, teacher allocation, timetable and exams." className="xl:col-span-2"><div className="space-y-4">{structure.classes.map((item) => <div key={item.id} className="rounded-xl border border-gray-100 p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold text-[#1a1a1a]">{item.name}</h3>{canEdit&&<div className="flex gap-3"><button onClick={()=>setEditItem({type:'class',classId:item.id,value:item.name})} className="inline-flex items-center gap-1 text-[13px] text-slate-500"><Pencil className="h-3.5 w-3.5"/>Edit</button><button onClick={() => askRemove({type:'class',classId:item.id,className:item.name,label:item.name})} className="inline-flex items-center gap-1 text-[13px] text-rose-600"><Trash2 className="h-3.5 w-3.5" />Remove</button></div>}</div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{item.sections.map((section) => <div key={section.name} className="rounded-xl border border-slate-100 bg-[#fafafa] p-3"><div className="flex items-center justify-between"><p className="text-[14px] font-medium text-[#333]">Section {section.name}</p>{canEdit&&<div className="flex gap-2"><button onClick={()=>setEditItem({type:'section',classId:item.id,section:section.name,value:section.name})} className="text-[12px] text-slate-500">Edit</button><button onClick={() => askRemove({type:'section',classId:item.id,className:item.name,section:section.name,label:`${item.name} · Section ${section.name}`})} className="text-[12px] text-rose-600">Remove</button></div>}</div><div className="mt-3 flex flex-wrap gap-2">{section.subjects.length ? section.subjects.map((itemSubject) => <span key={itemSubject} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[12px] font-bold text-blue-700">{itemSubject}{canEdit&&<><button onClick={()=>setEditItem({type:'subject',classId:item.id,section:section.name,subject:itemSubject,value:itemSubject})} title="Edit subject"><Pencil className="h-3 w-3"/></button><button onClick={() => askRemove({type:'subject',classId:item.id,className:item.name,section:section.name,subject:itemSubject,label:`${itemSubject} · ${item.name} ${section.name}`})} title="Remove subject" className="text-rose-500">×</button></>}</span>) : <span className="text-[13px] text-[#999]">No subjects assigned yet</span>}</div></div>)}{!item.sections.length && <p className="text-[13px] text-[#999]">No sections yet — use Step 3.</p>}</div></div>)}{!structure.classes.length && <div className="py-20 text-center text-[14px] text-[#999]">Start with the Academic Year, then add your first class.</div>}</div></Card></div>
    </>}
    {editItem&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[12px] font-bold uppercase tracking-wider text-indigo-600">Edit academic structure</p><h3 className="mt-1 text-xl font-bold text-slate-900">Rename {editItem.type}</h3></div><button onClick={()=>setEditItem(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div><p className="mt-3 text-[13px] leading-5 text-slate-500">The name will be standardised automatically. Existing connected records remain preserved.</p><input autoFocus value={editItem.value} onChange={(e)=>setEditItem({...editItem,value:e.target.value})} className="mt-5 h-12 w-full rounded-xl border border-slate-200 px-4 text-[14px] outline-none focus:border-indigo-300" /><div className="mt-5 flex justify-end gap-2"><Btn variant="outline" onClick={()=>setEditItem(null)}>Cancel</Btn><Btn icon={Save} onClick={saveEdit}>Save name</Btn></div></div></div>}
    {removeItem&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><ShieldAlert className="h-6 w-6"/></span><div><p className="text-[12px] font-bold uppercase tracking-wider text-rose-600">Protected removal</p><h3 className="mt-1 text-xl font-bold text-slate-900">Remove {removeItem.label}?</h3><p className="mt-2 text-[13px] leading-5 text-slate-500">This removes the option from future setup. Historical records remain stored, but existing connections may need reassignment.</p></div></div>{impact?<div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{[['Students',impact.students],['Teachers',impact.teacher_allocations],['Timetable',impact.timetable_periods],['Chapters',impact.curriculum_chapters],['Homework',impact.homework_records],['Exams',impact.exam_records]].map(([label,value])=><div key={label} className={`rounded-xl p-3 ${value?'bg-rose-50 text-rose-700':'bg-slate-50 text-slate-500'}`}><p className="text-lg font-bold">{value||0}</p><p className="text-[12px] font-semibold uppercase">{label}</p></div>)}</div>:<p className="mt-5 text-[13px] text-slate-500">Checking connected records…</p>}{impact?.total_connections>0&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-5 text-amber-800"><b>{impact.total_connections} connected record(s) found.</b> Review and reassign them after removal. No historical student, marks or attendance records will be deleted.</div>}<div className="mt-6 flex justify-end gap-2"><Btn variant="outline" onClick={()=>setRemoveItem(null)}>Keep it</Btn><button disabled={!impact} onClick={confirmRemove} className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-[13px] font-bold text-white disabled:opacity-50"><Trash2 className="h-4 w-4"/>Remove safely</button></div></div></div>}
  </Layout>;
}
