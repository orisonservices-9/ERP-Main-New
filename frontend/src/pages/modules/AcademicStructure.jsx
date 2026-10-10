import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { Card, PageTitle, Btn, Badge } from '../../components/Shared';
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, GraduationCap, Layers, LockKeyhole, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const makeId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function AcademicStructure() {
  const { auth } = useAuth();
  const [structure, setStructure] = useState({ academic_year: '', classes: [] });
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

  const load = async () => {
    setLoading(true);
    try {
      const [setup, request] = await Promise.all([api.get('/academic-structure'), api.get('/academic-year-change-request')]);
      setStructure({ academic_year: setup.data.academic_year || '', classes: setup.data.classes || [] });
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
      const { data } = await api.put('/academic-structure', { academic_year: structure.academic_year || year.trim(), classes: next.classes });
      setStructure(data); setYear(data.academic_year); setNotice('Academic setup saved successfully.'); return true;
    } catch (err) { setNotice(err.response?.data?.detail || 'Could not save the academic setup.'); return false; }
    finally { setSaving(false); }
  };
  const setFirstYear = () => save();
  const addClass = async () => {
    const name = className.trim();
    if (!name) { setNotice('Enter a class name.'); return; }
    if (structure.classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) { setNotice('This class already exists.'); return; }
    const next = { ...structure, classes: [...structure.classes, { id: makeId(), name, sections: [] }] };
    setStructure(next); setClassName(''); await save(next);
  };
  const addSection = async () => {
    if (!sectionClassId || !sectionName.trim()) { setNotice('Select a class and enter a section name.'); return; }
    const next = { ...structure, classes: structure.classes.map((item) => item.id !== sectionClassId ? item : { ...item, sections: item.sections.some((x) => x.name.toLowerCase() === sectionName.trim().toLowerCase()) ? item.sections : [...item.sections, { name: sectionName.trim(), subjects: [] }] }) };
    setStructure(next); setSectionName(''); await save(next);
  };
  const addSubjects = async () => {
    if (!target.classId || !target.section) { setNotice('Select a class and section first.'); return; }
    const requested = [...selectedSubjects, subject.trim()].filter(Boolean);
    if (!requested.length) { setNotice('Select an existing subject or enter a new subject.'); return; }
    const next = { ...structure, classes: structure.classes.map((item) => item.id !== target.classId ? item : { ...item, sections: item.sections.map((section) => { if (section.name !== target.section) return section; const existing = new Set(section.subjects.map((name) => name.toLowerCase())); const additions = requested.filter((name) => !existing.has(name.toLowerCase())); return { ...section, subjects: [...section.subjects, ...additions] }; }) }) };
    setStructure(next); setSubject(''); setSelectedSubjects([]); await save(next);
  };
  const removeClass = async (classId) => { const next = { ...structure, classes: structure.classes.filter((item) => item.id !== classId) }; setStructure(next); await save(next); };
  const removeSection = async (classId, name) => { const next = { ...structure, classes: structure.classes.map((item) => item.id !== classId ? item : { ...item, sections: item.sections.filter((section) => section.name !== name) }) }; setStructure(next); await save(next); };
  const removeSubject = async (classId, sectionName, subjectName) => { const next = { ...structure, classes: structure.classes.map((item) => item.id !== classId ? item : { ...item, sections: item.sections.map((section) => section.name !== sectionName ? section : { ...section, subjects: section.subjects.filter((item) => item !== subjectName) }) }) }; setStructure(next); await save(next); };
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
    <PageTitle title="Academic Setup" subtitle="Set the Academic Year once, then create classes, sections and subjects in separate steps." actions={<Btn icon={Save} onClick={() => save()}>{saving ? 'Saving…' : 'Save Setup'}</Btn>} />
    {notice && <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] ${success ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    {loading ? <div className="py-24 text-center text-[#888]">Loading academic setup…</div> : <>
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-4">{[{ label: 'Academic Year', value: structure.academic_year || 'Not set', icon: CalendarDays }, { label: 'Classes', value: structure.classes.length, icon: GraduationCap }, { label: 'Sections', value: sectionCount, icon: Layers }, { label: 'Unique Subjects', value: subjectCount, icon: BookOpen }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[#4F46E5]" /><p className="mt-4 font-poppins text-[22px] font-bold text-[#1a1a1a]">{value}</p><p className="text-[13px] text-[#888]">{label}</p></div>)}</div>
      {showYearWarning && <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-[#4F46E5]" /><div className="w-full"><h3 className="font-semibold text-[#9f1016]">Change Academic Year?</h3><p className="mt-1 text-[13px] text-[#7a3033]">Changing the Academic Year affects all future admissions, class setup, curriculum planning, teacher allocation and reports. Historical records stay preserved.</p><label className="mt-4 block text-[12px] font-medium text-[#7a3033]">New Academic Year<input autoFocus value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2027–2028" className="mt-1 block h-11 w-full max-w-md rounded-lg border border-indigo-200 bg-white px-3 text-[13px]" /></label><p className="mt-2 text-[12px] text-[#7a3033]">Are you sure you want to send this request to the Principal or Director?</p><div className="mt-4 flex gap-3"><Btn onClick={requestYearChange} disabled={!year.trim()}>Yes, request approval</Btn><Btn variant="outline" onClick={() => { setYear(structure.academic_year); setShowYearWarning(false); }}>Cancel</Btn></div></div></div></div>}
      {pendingRequest && <Card className="mb-6" title="Academic Year change approval"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="text-[13px] text-[#555]">Admin requested <strong>{pendingRequest.current_year}</strong> → <strong>{pendingRequest.requested_year}</strong>. Status: <Badge color="amber">Waiting for Admin OTP confirmation</Badge></div>{(auth?.role === 'principal' || auth?.role === 'director') ? <div className="max-w-sm rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Share this one-time code with the Admin: <strong className="ml-1 tracking-widest text-[#4F46E5]">{pendingRequest.otp}</strong><br /><span className="text-[#777]">The Admin must enter it to apply the change.</span></div> : <div className="max-w-sm"><p className="mb-2 text-[12px] text-[#777]">Ask the Principal or Director for the one-time approval code, then enter it here.</p><div className="flex gap-2"><input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter Principal/Director OTP" className="h-10 min-w-0 rounded-lg border border-gray-200 px-3 text-[13px]" /><Btn icon={LockKeyhole} onClick={confirmYearChange}>Confirm change</Btn></div></div>}</div></Card>}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="space-y-6 xl:col-span-1">
        <Card title="1. Academic Year" subtitle={structure.academic_year ? 'This is locked after setup. A change needs Principal or Director approval.' : 'Set this before creating classes.'}><div className="flex gap-3"><input value={year} disabled={Boolean(structure.academic_year)} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026–2027" className="min-w-0 flex-1 h-11 rounded-lg border border-gray-200 px-3 text-[13px] disabled:bg-gray-50 disabled:text-[#777]" />{structure.academic_year ? <Btn variant="outline" onClick={() => { setYear(''); setShowYearWarning(true); }}>Request change</Btn> : <Btn onClick={setFirstYear}>Set Year</Btn>}</div>{structure.academic_year && <p className="mt-3 text-[12px] text-[#888]">Click Request change. The new-year field will appear in the red confirmation box above.</p>}</Card>
        <Card title="2. Add Class" subtitle="Create the class first. Sections are added in the next step."><div className="space-y-3"><input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class, e.g. Class 1" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /><Btn icon={Plus} onClick={addClass}>Add Class</Btn></div></Card>
        <Card title="3. Add Section" subtitle="Add one section to a selected class."><div className="space-y-3"><select value={sectionClassId} onChange={(e) => setSectionClassId(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-[13px]"><option value="">Select class</option>{structure.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="Section, e.g. A" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /><Btn icon={Plus} onClick={addSection}>Add Section</Btn></div></Card>
        <Card title="4. Assign Subjects" subtitle="Reuse subjects from another section and add any new subjects needed."><div className="space-y-3"><select value={target.classId} onChange={(e) => { setTarget({ classId: e.target.value, section: '' }); setSelectedSubjects([]); setSubject(''); }} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-[13px]"><option value="">Select class</option>{structure.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={target.section} onChange={(e) => { setTarget({ ...target, section: e.target.value }); setSelectedSubjects([]); setSubject(''); }} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-[13px]" disabled={!targetClass}><option value="">Select section</option>{targetClass?.sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>{target.section && <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-[12px] font-semibold text-[#333]">Subjects used in other sections</p><p className="text-[11px] text-[#888]">Select one, multiple, or all suggested subjects.</p></div>{suggestedSubjects.length > 0 && <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-indigo-600"><input type="checkbox" checked={selectedSubjects.length === suggestedSubjects.length} onChange={() => setSelectedSubjects(selectedSubjects.length === suggestedSubjects.length ? [] : [...suggestedSubjects])} className="h-4 w-4 accent-indigo-600" />Select all</label>}</div>{suggestedSubjects.length ? <div className="mt-3 flex flex-wrap gap-2">{suggestedSubjects.map((name) => <label key={name} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium ${selectedSubjects.includes(name) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-[#555]'}`}><input type="checkbox" checked={selectedSubjects.includes(name)} onChange={() => toggleSuggestedSubject(name)} className="h-4 w-4 accent-indigo-600" />{name}</label>)}</div> : <p className="mt-3 text-[11px] text-[#999]">No additional subjects are available from another section.</p>}{(targetSection?.subjects || []).length > 0 && <p className="mt-3 border-t border-gray-200 pt-2 text-[11px] text-[#777]">Already assigned here: <span className="font-semibold">{targetSection.subjects.join(', ')}</span></p>}</div>}<div><p className="mb-1 text-[11px] font-medium text-[#666]">Add a new subject (optional)</p><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Computer Science" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></div><Btn icon={Plus} onClick={addSubjects}>Assign {selectedSubjects.length > 1 ? `${selectedSubjects.length} Subjects` : 'Subjects'}</Btn></div></Card>
      </div>
      <Card title="Your Academic Structure" subtitle="Only this setup is available in admissions, student import, curriculum and teacher allocation." className="xl:col-span-2"><div className="space-y-4">{structure.classes.map((item) => <div key={item.id} className="rounded-xl border border-gray-100 p-4"><div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold text-[#1a1a1a]">{item.name}</h3><button onClick={() => removeClass(item.id)} className="inline-flex items-center gap-1 text-[12px] text-[#4F46E5]"><Trash2 className="h-4 w-4" />Remove class</button></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{item.sections.map((section) => <div key={section.name} className="rounded-lg bg-[#fafafa] p-3"><div className="flex items-center justify-between"><p className="text-[13px] font-medium text-[#333]">Section {section.name}</p><button onClick={() => removeSection(item.id, section.name)} className="text-[11px] text-[#4F46E5]">Remove</button></div><div className="mt-2 flex flex-wrap gap-2">{section.subjects.length ? section.subjects.map((itemSubject) => <button key={itemSubject} onClick={() => removeSubject(item.id, section.name, itemSubject)} title="Remove subject"><Badge color="blue">{itemSubject} ×</Badge></button>) : <span className="text-[12px] text-[#999]">No subjects assigned yet</span>}</div></div>)}{!item.sections.length && <p className="text-[12px] text-[#999]">No sections yet — use Step 3.</p>}</div></div>)}{!structure.classes.length && <div className="py-20 text-center text-[13px] text-[#999]">Start with the Academic Year, then add your first class.</div>}</div></Card></div>
    </>}
  </Layout>;
}
