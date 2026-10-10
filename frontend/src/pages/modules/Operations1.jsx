import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table } from '../../components/Shared';
import { BookOpen, CheckCircle2, Clock, FileText, Plus, CalendarDays, Download, Paperclip, Send, Loader2, Trash2, UsersRound, AlertTriangle, ClipboardCheck, GraduationCap, Sparkles } from 'lucide-react';
import { downloadCSV, printPage } from '../../utils';
import api from '../../api';

const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const HomeworkManagement = ({ mode = 'add' }) => {
  const [q, setQ] = useState('');
  const [structure, setStructure] = useState({ academic_year: '', classes: [] });
  const [homework, setHomework] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [filters, setFilters] = useState({ class_name: '', section: '', status: 'All' });
  const [form, setForm] = useState({ class_name: '', section: '', subject: '', due_date: '', instructions: '', send_parent_app: true, send_whatsapp: true });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const load = async () => {
    try {
      const [setupResponse, homeworkResponse, completionResponse] = await Promise.all([api.get('/academic-structure'), api.get('/homework'), api.get('/parent-center/homework-completions')]);
      setStructure(setupResponse.data || { academic_year: '', classes: [] }); setHomework(homeworkResponse.data || []); setCompletions(completionResponse.data || []);
    } catch { setNotice('Could not load Academic Setup or saved homework. Please restart the backend and try again.'); }
  };
  useEffect(() => { load(); }, []);
  const selectedClass = (structure.classes || []).find((item) => item.name === form.class_name);
  const sections = selectedClass?.sections || [];
  const selectedSection = sections.find((item) => item.name === form.section);
  const subjects = selectedSection?.subjects || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueState = (item) => { const due = new Date(`${item.due_date}T00:00:00`); if (item.status !== 'Active') return 'Closed'; if (due < today) return 'Overdue'; const days = Math.ceil((due - today) / 86400000); return days === 0 ? 'Due today' : days <= 7 ? 'Due this week' : 'Upcoming'; };
  const filterClass = (structure.classes || []).find((item) => item.name === filters.class_name);
  const filterSections = filterClass?.sections || [];
  const rows = homework.filter((item) => [item.subject, item.class_name, item.section, item.instructions].join(' ').toLowerCase().includes(q.toLowerCase())).filter((item) => !filters.class_name || item.class_name === filters.class_name).filter((item) => !filters.section || item.section === filters.section).filter((item) => filters.status === 'All' || dueState(item) === filters.status);
  const overdue = homework.filter((item) => dueState(item) === 'Overdue').length;
  const dueThisWeek = homework.filter((item) => ['Due today', 'Due this week'].includes(dueState(item))).length;
  const activeGroups = new Set(homework.filter((item) => item.status === 'Active').map((item) => `${item.class_name}|${item.section}`)).size;
  const completedUpdates = completions.filter((item) => item.completed).length;
  const exportCSV = () => downloadCSV('homework.csv', ['Subject', 'Class', 'Section', 'Due date', 'Instructions', 'Parent App', 'WhatsApp'], rows.map((item) => [item.subject, item.class_name, item.section, item.due_date, item.instructions, item.send_parent_app ? 'Yes' : 'No', item.send_whatsapp ? 'Yes' : 'No']));
  const chooseClass = (event) => setForm((current) => ({ ...current, class_name: event.target.value, section: '', subject: '' }));
  const chooseSection = (event) => setForm((current) => ({ ...current, section: event.target.value, subject: '' }));
  const submit = async (event) => {
    event.preventDefault(); setNotice('');
    if (!form.class_name || !form.section || !form.instructions.trim() || !form.due_date) { setNotice('Choose Class and Section, enter homework and set a due date.'); return; }
    setSaving(true);
    try {
      const attachments = [];
      for (const file of files) { const data = new FormData(); data.append('file', file); const response = await api.post('/homework/attachment', data, { headers: { 'Content-Type': 'multipart/form-data' } }); attachments.push(response.data); }
      const response = await api.post('/homework', { ...form, instructions: form.instructions.trim(), attachments });
      setHomework((current) => [response.data, ...current]);
      setNotice(`Homework assigned successfully. ${response.data.notifications_queued || 0} parent notification(s) were queued.`);
      setForm({ class_name: '', section: '', subject: '', due_date: '', instructions: '', send_parent_app: true, send_whatsapp: true }); setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) { setNotice(error.response?.data?.detail || 'Could not assign homework. Please try again.'); }
    finally { setSaving(false); }
  };
  return (
    <Layout>
      <PageTitle title={mode === 'add' ? 'Add Homework' : 'Homework Reports'} subtitle={mode === 'add' ? 'Create a focused assignment for the correct Class, Section and Subject.' : 'Track deadlines, overdue work and real student completion updates.'}
        actions={mode === 'reports' ? <Btn variant="outline" icon={Download} onClick={exportCSV}>Download Register</Btn> : undefined} />
      {mode === 'reports' && <section className="mb-6 overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-7 text-white shadow-[0_24px_60px_rgba(49,46,129,0.24)]">
        <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-center"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-100"><Sparkles className="h-3.5 w-3.5" /> Learning follow-through</span><h2 className="mt-4 font-poppins text-[27px] font-bold tracking-[-0.04em]">Every assignment should lead to action</h2><p className="mt-2 max-w-xl text-[12px] leading-5 text-indigo-100/70">See what is due, what is late and where families have confirmed completion—without communication counters or sample data.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[[BookOpen,'Active',homework.filter((item)=>item.status==='Active').length],[AlertTriangle,'Overdue',overdue],[CalendarDays,'Due this week',dueThisWeek],[ClipboardCheck,'Marked done',completedUpdates]].map(([Icon,label,value])=><div key={label} className="min-w-[118px] rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur"><span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${label==='Overdue'&&value?'bg-rose-400/20 text-rose-200':'bg-white/10 text-indigo-100'}`}><Icon className="h-4 w-4"/></span><p className="font-poppins text-[21px] font-bold">{value}</p><p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-indigo-100/55">{label}</p></div>)}</div></div>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-[10px] font-semibold text-indigo-100/70"><span className="rounded-full bg-white/[0.08] px-3 py-1.5">{activeGroups} active Class & Section groups</span><span className="rounded-full bg-white/[0.08] px-3 py-1.5">{completions.length} parent status updates received</span><span className="rounded-full bg-white/[0.08] px-3 py-1.5">Academic Year {structure.academic_year || 'Not set'}</span></div>
      </section>}
      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('successfully') ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{notice}</div>}
      {mode === 'add' && <Card title="Create a focused assignment" subtitle="Set the exact Class, Section, Subject, instructions and a realistic deadline. Attach learning material when useful.">
        <form onSubmit={submit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-[11px] font-medium text-[#666]">Class<select value={form.class_name} onChange={chooseClass} className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-[#4F46E5]"><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
            <label className="text-[11px] font-medium text-[#666]">Section<select value={form.section} onChange={chooseSection} disabled={!form.class_name} className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-[#4F46E5] disabled:opacity-50"><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
            <label className="text-[11px] font-medium text-[#666]">Subject <span className="font-normal text-[#aaa]">(optional)</span><select value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} disabled={!form.section} className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-[#4F46E5] disabled:opacity-50"><option value="">General homework</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
            <label className="text-[11px] font-medium text-[#666]">Due date<input value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} type="date" className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-[#4F46E5]" /></label>
          </div>
          <label className="mt-5 block text-[11px] font-medium text-[#666]">Homework instructions<textarea value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} rows="4" placeholder="Type the homework students need to complete..." className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-3 text-[13px] outline-none focus:border-[#4F46E5]" /></label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#fafafa] px-4 py-3">
            <div><input ref={fileRef} onChange={(event) => setFiles(Array.from(event.target.files || []))} type="file" multiple className="hidden" id="homework-files" /><label htmlFor="homework-files" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-[#555] hover:bg-gray-50"><Paperclip className="h-4 w-4" /> Add images, PDFs or files</label>{files.length > 0 && <span className="ml-3 text-[12px] text-[#777]">{files.map((file) => file.name).join(', ')}</span>}</div>
            <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-[12px] text-[#555]"><input checked={form.send_parent_app} onChange={(event) => setForm((current) => ({ ...current, send_parent_app: event.target.checked }))} type="checkbox" className="h-4 w-4 accent-[#4F46E5]" /> Show in Parent App</label><label className="flex items-center gap-2 text-[12px] text-[#555]"><input checked={form.send_whatsapp} onChange={(event) => setForm((current) => ({ ...current, send_whatsapp: event.target.checked }))} type="checkbox" className="h-4 w-4 accent-[#4F46E5]" /> Send WhatsApp message</label><Btn type="submit" icon={saving ? Loader2 : Send} disabled={saving}>{saving ? 'Assigning...' : 'Assign Homework'}</Btn></div>
          </div>
        </form>
      </Card>}
      {mode === 'reports' && <Card title="Homework action register" subtitle="Prioritise overdue work, review upcoming deadlines and open the exact learning material assigned." action={<SearchBar placeholder="Search homework..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-3"><select value={filters.class_name} onChange={(e)=>setFilters({class_name:e.target.value,section:'',status:filters.status})} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700"><option value="">All Classes</option>{(structure.classes||[]).map((item)=><option key={item.name}>{item.name}</option>)}</select><select value={filters.section} onChange={(e)=>setFilters({...filters,section:e.target.value})} disabled={!filters.class_name} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 disabled:opacity-50"><option value="">All Sections</option>{filterSections.map((item)=><option key={item.name}>{item.name}</option>)}</select><select value={filters.status} onChange={(e)=>setFilters({...filters,status:e.target.value})} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700">{['All','Overdue','Due today','Due this week','Upcoming','Closed'].map((item)=><option key={item}>{item}</option>)}</select></div>
        <Table columns={[{label:'Subject / Assignment'},{label:'Class & Section'},{label:'Deadline'},{label:'Learning Material'},{label:'Completion Updates'},{label:'Priority'}]}>
          {rows.map((h) => (
            <tr key={h.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 pr-4"><p className="text-[13px] font-medium text-[#1a1a1a]">{h.subject}</p><p className="mt-0.5 max-w-sm truncate text-[11px] text-[#888]">{h.instructions}</p></td>
              <td className="py-3 text-[13px] text-[#666]">{h.class_name}<span className="block text-[11px] text-[#999]">{h.section}</span></td>
              <td className="py-3 text-[13px] text-[#666]">{h.due_date}<span className="mt-0.5 block text-[10px] text-slate-400">Assigned by {h.assigned_by || 'School'}</span></td>
              <td className="py-3 text-[12px] text-[#666]">{h.attachments?.length ? h.attachments.map((file) => <a key={file.url} className="mr-2 text-[#4F46E5] hover:underline" href={file.url} target="_blank" rel="noreferrer">{file.name}</a>) : 'None'}</td>
              <td className="py-3"><p className="text-[12px] font-bold text-slate-700">{completions.filter((item)=>item.homework_id===h.id&&item.completed).length} done</p><p className="text-[9px] text-slate-400">{completions.filter((item)=>item.homework_id===h.id).length} responses</p></td>
              <td className="py-3"><Badge color={dueState(h)==='Overdue'?'red':dueState(h)==='Due today'?'amber':dueState(h)==='Due this week'?'blue':'gray'}>{dueState(h)}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-[#999]">No homework has been assigned yet.</td></tr>}
        </Table>
      </Card>}
    </Layout>
  );
};

export const TimetableManagement = ({ mode = 'create' }) => {
  const days = TIMETABLE_DAYS;
  const subjectStyles = ['bg-indigo-50 text-[#4F46E5] border-indigo-100', 'bg-blue-50 text-blue-700 border-blue-100', 'bg-green-50 text-green-700 border-green-100', 'bg-purple-50 text-purple-700 border-purple-100', 'bg-amber-50 text-amber-700 border-amber-100', 'bg-cyan-50 text-cyan-700 border-cyan-100'];
  const [structure, setStructure] = useState({ academic_year: '', classes: [] });
  const [allocations, setAllocations] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [group, setGroup] = useState({ class_name: '', section: '' });
  const [rangeFilter, setRangeFilter] = useState({ from: '', to: '' });
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [printVersion, setPrintVersion] = useState(null);
  const [form, setForm] = useState({ schedule_scope: 'Week', effective_from: new Date().toISOString().slice(0,10), effective_to: new Date().toISOString().slice(0,10), day: 'Monday', start_time: '08:30', end_time: '09:15', subject: '', room: '' });
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [setup, allocationResponse, periodResponse] = await Promise.all([api.get('/academic-structure'), api.get('/teacher-allocations'), api.get('/timetable-periods')]);
      setStructure(setup.data || { academic_year: '', classes: [] });
      setAllocations(Array.isArray(allocationResponse.data) ? allocationResponse.data : []);
      setPeriods(Array.isArray(periodResponse.data) ? periodResponse.data : []);
    } catch { setNotice('Could not load the timetable. Please ensure the backend is running.'); }
  };
  useEffect(() => { load(); }, []);
  const selectedClass = (structure.classes || []).find((item) => item.name === group.class_name);
  const sections = selectedClass?.sections || [];
  const selectedSection = sections.find((item) => item.name === group.section);
  const subjects = selectedSection?.subjects || [];
  const overlapsRange = (item) => (!rangeFilter.from || !item.effective_to || item.effective_to >= rangeFilter.from) && (!rangeFilter.to || !item.effective_from || item.effective_from <= rangeFilter.to);
  const reportMonthStart = reportMonth ? `${reportMonth}-01` : '';
  const reportMonthEnd = reportMonth ? (() => { const [year, month] = reportMonth.split('-').map(Number); return new Date(year, month, 0).toISOString().slice(0,10); })() : '';
  const overlapsReportMonth = (item) => (!reportMonthStart || !item.effective_to || item.effective_to >= reportMonthStart) && (!reportMonthEnd || !item.effective_from || item.effective_from <= reportMonthEnd);
  const scopedPeriods = periods.filter((item) => mode === 'create' || (mode === 'reports' ? overlapsReportMonth(item) : overlapsRange(item)));
  const groupPeriods = scopedPeriods.filter((item) => item.class_name === group.class_name && item.section === group.section);
  const slots = [...new Set(groupPeriods.map((item) => `${item.start_time}|${item.end_time}`))].map((item) => { const [start_time, end_time] = item.split('|'); return { start_time, end_time }; }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const allocatedCount = new Set(groupPeriods.map((item) => item.teacher_id)).size;
  const visibleScopes = [...new Set(groupPeriods.map((item) => item.schedule_scope || 'Recurring'))];
  const visibleRangeStart = rangeFilter.from || [...groupPeriods].map((item) => item.effective_from).filter(Boolean).sort()[0] || '';
  const visibleRangeEnd = rangeFilter.to || [...groupPeriods].map((item) => item.effective_to).filter(Boolean).sort().reverse()[0] || '';
  const displayTimetableDate = (value) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('-') : value;
  const teacherForSubject = allocations.find((item) => item.class_name === group.class_name && item.section === group.section && item.subject === form.subject);
  const pageCopy = {
    create: { title: 'Create Timetable', subtitle: 'Build a conflict-free weekly schedule from your Academic Setup and teacher allocations.' },
    view: { title: 'View Timetable', subtitle: 'Open the weekly timetable for the selected Class and Section.' },
    reports: { title: 'Timetable Reports', subtitle: 'View only the school days where every configured subject has been scheduled with an assigned teacher.' },
  }[mode] || { title: 'Timetable Management', subtitle: '' };
  const reportRows = useMemo(() => {
    const allGroups = (structure.classes || []).flatMap((classItem) => (classItem.sections || []).map((sectionItem) => ({ class_name: classItem.name, section: sectionItem.name, subjects: sectionItem.subjects || [] })));
    return allGroups.filter((item) => (!group.class_name || item.class_name === group.class_name) && (!group.section || item.section === group.section)).flatMap((item) => {
      const groupSchedulePeriods = scopedPeriods.filter((period) => period.class_name === item.class_name && period.section === item.section);
      const versions = [...new Set(groupSchedulePeriods.map((period) => `${period.schedule_scope || 'Recurring'}|${period.effective_from || ''}|${period.effective_to || ''}`))];
      return versions.map((version) => { const [schedule_scope,effective_from,effective_to]=version.split('|'); const weeklyPeriods=groupSchedulePeriods.filter((period)=>`${period.schedule_scope || 'Recurring'}|${period.effective_from || ''}|${period.effective_to || ''}`===version);
      const scheduledSubjects = new Set(weeklyPeriods.map((period) => period.subject));
      const missingSubjects = item.subjects.filter((subject) => !scheduledSubjects.has(subject));
      const allocatedPeriods = weeklyPeriods.filter((period) => period.teacher_id && period.teacher_name).length;
      const coverage = item.subjects.length ? Math.round(((item.subjects.length - missingSubjects.length) / item.subjects.length) * 100) : 0;
      return { ...item, schedule_scope, effective_from, effective_to, period_count: weeklyPeriods.length, teaching_days: new Set(weeklyPeriods.map((period) => period.day)).size, teachers: new Set(weeklyPeriods.map((period) => period.teacher_id).filter(Boolean)).size, allocated_periods: allocatedPeriods, missingSubjects, coverage, status: coverage === 100 && allocatedPeriods === weeklyPeriods.length && weeklyPeriods.length ? 'Ready' : 'Needs attention' };
      });
    });
  }, [structure, scopedPeriods, group]);
  const incompleteDays = reportRows.filter((item) => item.status !== 'Ready').length;
  const totalSchoolPeriods = periods.length;
  const teacherUtilization = new Set(periods.map((item) => item.teacher_id).filter(Boolean)).size;
  const downloadTimetableVersion = (item) => { setPrintVersion(item); setTimeout(printPage, 80); };
  const setClass = (class_name) => { setGroup({ class_name, section: '' }); setForm((current) => ({ ...current, subject: '' })); };
  const setSection = (section) => { setGroup((current) => ({ ...current, section })); setForm((current) => ({ ...current, subject: '' })); };
  const savePeriod = async () => {
    setNotice('');
    if (!group.class_name || !group.section || !form.subject || !form.start_time || !form.end_time) { setNotice('Select Class, Section and Subject, then complete the day and time.'); return; }
    setSaving(true);
    try {
      if (!form.effective_from || !form.effective_to || form.effective_to < form.effective_from) { setNotice('Choose a valid From and To calendar range.'); setSaving(false); return; }
      if (form.schedule_scope === 'Day' && form.effective_from !== form.effective_to) { setNotice('For a one-day timetable, From and To dates must be the same.'); setSaving(false); return; }
      const selectedDay = form.schedule_scope === 'Day' ? new Date(`${form.effective_from}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }) : form.day;
      await api.post('/timetable-periods', { ...group, ...form, day: selectedDay, academic_year: structure.academic_year });
      setNotice(`${form.subject} was added to the timetable.`);
      setForm((current) => ({ ...current, subject: '', room: '' }));
      await load();
    } catch (error) { setNotice(error.response?.data?.detail || 'Could not save this timetable period.'); }
    finally { setSaving(false); }
  };
  const removePeriod = async (id) => {
    if (!window.confirm('Remove this period from the timetable?')) return;
    try { await api.delete(`/timetable-periods/${id}`); setNotice('Period removed.'); await load(); }
    catch (error) { setNotice(error.response?.data?.detail || 'Could not remove this period.'); }
  };
  return (
    <Layout>
      <PageTitle title={pageCopy.title} subtitle={pageCopy.subtitle}
        actions={<div className="flex gap-2">{mode === 'view' && group.section && <Btn variant="outline" icon={Download} onClick={printPage}>Print Timetable</Btn>}<Btn variant="outline" icon={CalendarDays}>{structure.academic_year || 'Academic Year not set'}</Btn></div>} />
      <section className="mb-6 overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-7 text-white shadow-[0_24px_60px_rgba(49,46,129,.24)]"><div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-indigo-100"><Sparkles className="h-3.5 w-3.5"/> Weekly learning plan</span><h2 className="mt-4 font-poppins text-[27px] font-bold">{mode==='create'?'Build a clash-free school week':mode==='view'?'One clear timetable for every Class':'Measure weekly timetable readiness'}</h2><p className="mt-2 max-w-xl text-[12px] leading-5 text-indigo-100/70">{mode==='create'?'Teacher allocations and time conflicts are checked before every period is saved.':mode==='view'?'Review subjects, teachers, rooms and open slots in one printable weekly grid.':'Find missing subjects, incomplete teacher allocation and groups that are ready to publish.'}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[[Clock,'School periods',totalSchoolPeriods],[UsersRound,'Teachers used',teacherUtilization],[CalendarDays,'Active groups',new Set(periods.map(p=>`${p.class_name}|${p.section}`)).size],[CheckCircle2,'Ready groups',reportRows.filter(r=>r.status==='Ready').length]].map(([Icon,label,value])=><div key={label} className="min-w-[118px] rounded-2xl border border-white/10 bg-white/[.08] p-4"><Icon className="mb-3 h-4 w-4 text-indigo-200"/><p className="font-poppins text-[20px] font-bold">{value}</p><p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-indigo-100/55">{label}</p></div>)}</div></div></section>
      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('added') || notice.includes('removed') ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{notice}</div>}
      <Card title={mode === 'reports' ? 'Filter readiness report' : '1. Select Class and Section'} subtitle={mode === 'reports' ? 'Leave filters blank to compare every configured Class and Section.' : 'Open the exact weekly schedule you want to create or review.'}>
        <div className={`grid grid-cols-1 gap-4 ${mode==='reports'?'md:grid-cols-4':'md:grid-cols-3'}`}>
          <label className="text-[12px] font-medium text-[#555]">Class<select value={group.class_name} onChange={(event) => setClass(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
          <label className="text-[12px] font-medium text-[#555]">Section<select value={group.section} disabled={!group.class_name} onChange={(event) => setSection(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300 disabled:opacity-50"><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
          {mode === 'reports' && <label className="text-[12px] font-medium text-[#555]">Month<input type="month" value={reportMonth} onChange={(event)=>setReportMonth(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"/></label>}
          <div className="self-end rounded-xl bg-indigo-50 px-4 py-3 text-[12px] text-indigo-800">{mode === 'reports' ? <>Showing <b>{reportRows.length}</b> Class & Section group{reportRows.length === 1 ? '' : 's'}.</> : group.section ? <><b>{groupPeriods.length}</b> scheduled periods · <b>{allocatedCount}</b> teachers</> : 'Select both Class and Section to open its timetable.'}</div>
        </div>
        {mode === 'view' && <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">From date<input type="date" value={rangeFilter.from} onChange={(event)=>setRangeFilter(current=>({...current,from:event.target.value}))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] outline-none focus:border-indigo-300"/></label><label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">To date<input type="date" min={rangeFilter.from} value={rangeFilter.to} onChange={(event)=>setRangeFilter(current=>({...current,to:event.target.value}))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] outline-none focus:border-indigo-300"/></label></div>}
      </Card>
      {mode === 'create' && group.section && <>
      <Card title="2. Choose calendar scope" subtitle="Pick one calendar date, then decide whether the schedule applies to that day, its week or its month.">
        <div className="grid gap-4"><div className="grid grid-cols-3 gap-3">{[['Day','One selected date'],['Week','Selected date range'],['Month','Selected date range']].map(([scope,copy])=><button type="button" key={scope} onClick={()=>setForm(current=>({...current,schedule_scope:scope,effective_to:scope==='Day'?current.effective_from:current.effective_to}))} className={`rounded-2xl border p-4 text-left transition ${form.schedule_scope===scope?'border-indigo-300 bg-indigo-50 ring-4 ring-indigo-50':'border-slate-200 bg-white hover:border-indigo-200'}`}><CalendarDays className={`mb-3 h-5 w-5 ${form.schedule_scope===scope?'text-indigo-600':'text-slate-400'}`}/><b className="block text-[12px] text-slate-800">{scope}</b><span className="mt-1 block text-[9px] text-slate-400">{copy}</span></button>)}</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">From date<input type="date" value={form.effective_from} onChange={(event)=>setForm(current=>({...current,effective_from:event.target.value,effective_to:current.schedule_scope==='Day'?event.target.value:current.effective_to}))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"/></label><label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">To date<input type="date" value={form.effective_to} min={form.effective_from} disabled={form.schedule_scope==='Day'} onChange={(event)=>setForm(current=>({...current,effective_to:event.target.value}))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50"/></label></div></div>
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] text-indigo-800"><b>{form.schedule_scope} schedule:</b> {form.schedule_scope==='Day'?'The period applies only on this date.':'The period repeats on the selected weekday from the From date through the To date.'}</div>
      </Card>
      <Card title="3. Add a timetable period" subtitle="The selected subject must already have a teacher allocated. Class and teacher clashes are blocked only when calendar ranges overlap.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-[12px] font-medium text-[#555]">{form.schedule_scope==='Day'?'Day from calendar':'Repeat on'}<select value={form.schedule_scope==='Day'?new Date(`${form.effective_from}T00:00:00`).toLocaleDateString('en-US',{weekday:'long'}):form.day} disabled={form.schedule_scope==='Day'} onChange={(event) => setForm((current) => ({ ...current, day: event.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300 disabled:bg-slate-50">{days.map((day) => <option key={day}>{day}</option>)}</select></label>
          <label className="text-[12px] font-medium text-[#555]">Start time<input type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300" /></label>
          <label className="text-[12px] font-medium text-[#555]">End time<input type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300" /></label>
          <label className="text-[12px] font-medium text-[#555]">Subject<select value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"><option value="">Select subject</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
          <label className="text-[12px] font-medium text-[#555]">Room <span className="font-normal text-[#aaa]">(optional)</span><input value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="e.g. Room 101" className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafafa] px-4 py-3"><p className="text-[12px] text-[#666]">{form.subject ? (teacherForSubject ? <>Teacher: <span className="font-semibold text-[#333]">{teacherForSubject.teacher_name}</span></> : <span className="text-amber-700">No teacher is allocated to this subject yet. Allocate one first.</span>) : 'Choose a subject to see the allocated teacher.'}</p><Btn icon={saving ? Loader2 : Plus} onClick={savePeriod} disabled={saving}>{saving ? 'Adding…' : 'Add Period'}</Btn></div>
      </Card>
      </>}
      {mode === 'view' && group.section && <>
      <Card title={`${group.class_name} — ${group.section} · ${visibleScopes.join(' / ') || 'Weekly'} Timetable${visibleRangeStart || visibleRangeEnd ? ` · ${displayTimetableDate(visibleRangeStart) || 'Start'} to ${displayTimetableDate(visibleRangeEnd) || 'End'}` : ''}`} subtitle="Each block shows only the subject, assigned teacher and room. The applicable timetable type and date range are shown once above.">
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: '6px' }}>
            <thead><tr><th className="text-[11px] text-[#a0a0a0] font-medium w-24">Time</th>{days.map((day) => <th key={day} className="text-[12px] font-semibold text-[#333] py-2">{day}</th>)}</tr></thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={`${slot.start_time}-${slot.end_time}`}>
                  <td className="text-[11px] text-[#777] font-medium text-center">{slot.start_time}<br />{slot.end_time}</td>
                  {days.map((day, index) => { const item = groupPeriods.find((period) => period.day === day && period.start_time === slot.start_time && period.end_time === slot.end_time); return <td key={day} className="min-w-[135px]">{item ? <div className={`min-h-[74px] rounded-lg border p-2 text-left ${subjectStyles[index % subjectStyles.length]}`}><p className="text-[12px] font-semibold">{item.subject}</p><p className="mt-1 text-[10px] opacity-80">{item.teacher_name}</p>{item.room && <p className="mt-0.5 text-[10px] opacity-70">{item.room}</p>}</div> : <div className="min-h-[74px] rounded-lg border border-dashed border-gray-100 bg-[#fcfcfc]" />}</td>; })}
                </tr>
              ))}
              {slots.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-[13px] text-[#999]">No periods have been added for this Class and Section yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      </>}
      {mode === 'reports' && <>
      <Card title={`${reportMonth ? new Date(`${reportMonth}-01T00:00:00`).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) : 'Selected month'} timetable versions`} subtitle={`${reportRows.length} timetable version${reportRows.length===1?'':'s'} · ${reportRows.length-incompleteDays} ready · ${incompleteDays} need attention`} pad="p-0"><div className="overflow-x-auto"><Table columns={[{label:'Class / Section'},{label:'Timetable type'},{label:'Effective dates'},{label:'Subject coverage'},{label:'Missing subjects'},{label:'Periods'},{label:'Readiness / Download'}]}>{reportRows.map((item)=><tr key={`${item.class_name}-${item.section}-${item.schedule_scope}-${item.effective_from}-${item.effective_to}`} className="border-b border-slate-50"><td className="px-6 py-4"><b className="text-[12px] text-slate-800">{item.class_name}</b><span className="block text-[9px] text-slate-400">{item.section}</span></td><td className="py-4"><Badge color="blue">{item.schedule_scope}</Badge></td><td className="py-4 text-[10px] text-slate-500">{displayTimetableDate(item.effective_from)||'Legacy'}{item.effective_to?` to ${displayTimetableDate(item.effective_to)}`:''}</td><td className="py-4"><b className="text-[12px] text-indigo-700">{item.coverage}%</b><p className="text-[9px] text-slate-400">{item.subjects.length-item.missingSubjects.length} of {item.subjects.length}</p></td><td className="max-w-[180px] py-4 text-[10px] text-slate-500">{item.missingSubjects.join(', ')||'None'}</td><td className="py-4 text-[12px] text-slate-600">{item.period_count}</td><td className="py-4 pr-6"><div className="flex items-center gap-2"><Badge color={item.status==='Ready'?'green':'amber'}>{item.status}</Badge><button type="button" onClick={()=>downloadTimetableVersion(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-[9px] font-bold text-indigo-700 hover:bg-indigo-100"><Download className="h-3 w-3"/>Download</button></div></td></tr>)}</Table>{!reportRows.length&&<div className="py-14 text-center text-[13px] text-slate-400">No timetable is active in the selected month.</div>}</div></Card>
      {printVersion && <div id="single-timetable-download" className="hidden bg-white p-6 text-slate-900"><style>{`@media print{body *{visibility:hidden!important}#single-timetable-download,#single-timetable-download *{visibility:visible!important}#single-timetable-download{display:block!important;position:absolute;left:0;top:0;width:100%}@page{size:A4 landscape;margin:10mm}}`}</style><header className="mb-5 border-b-4 border-indigo-950 pb-4"><h1 className="text-[24px] font-black text-indigo-950">{printVersion.class_name} — {printVersion.section}</h1><p className="mt-1 text-[11px] text-slate-500">{printVersion.schedule_scope} Timetable · {displayTimetableDate(printVersion.effective_from)} to {displayTimetableDate(printVersion.effective_to)}</p></header><table className="w-full border-collapse text-[10px]"><thead><tr className="bg-indigo-950 text-white"><th className="border p-2">Day</th><th className="border p-2">Time</th><th className="border p-2">Subject</th><th className="border p-2">Teacher</th><th className="border p-2">Room</th></tr></thead><tbody>{scopedPeriods.filter((period)=>period.class_name===printVersion.class_name&&period.section===printVersion.section&&(period.schedule_scope||'Recurring')===printVersion.schedule_scope&&(period.effective_from||'')===printVersion.effective_from&&(period.effective_to||'')===printVersion.effective_to).sort((a,b)=>days.indexOf(a.day)-days.indexOf(b.day)||a.start_time.localeCompare(b.start_time)).map((period)=><tr key={period.id}><td className="border border-slate-300 p-2 font-bold">{period.day}</td><td className="border border-slate-300 p-2 text-center">{period.start_time} – {period.end_time}</td><td className="border border-slate-300 p-2">{period.subject}</td><td className="border border-slate-300 p-2">{period.teacher_name}</td><td className="border border-slate-300 p-2">{period.room||'—'}</td></tr>)}</tbody></table></div>}
      </>}
    </Layout>
  );
};
