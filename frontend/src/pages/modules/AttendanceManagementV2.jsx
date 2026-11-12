import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle, CalendarCheck, CalendarOff, CheckCircle2, ChevronDown, Clock,
  Download, FileText, History, Hourglass, PencilLine, RotateCcw, Save, Search,
  ShieldCheck, Sparkles, UserCheck, UserRoundX, Users, X, XCircle,
} from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api';
import { Badge, Btn, Card, PageTitle } from '../../components/Shared';
import { downloadCSV, printPage } from '../../utils';

const STATUS_META = {
  'Not marked': { tone: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  Present: { tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Absent: { tone: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  Late: { tone: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  Leave: { tone: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
};

const monthBounds = (month) => {
  const [year, value] = month.split('-').map(Number);
  const from = `${year}-${String(value).padStart(2, '0')}-01`;
  const to = new Date(year, value, 0).toLocaleDateString('en-CA');
  return { from, to };
};

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
const roleTitle = (role) => role === 'student' ? 'Students' : role === 'teacher' ? 'Teachers' : 'Staff';

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META['Not marked'];
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold ${meta.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{status}</span>;
};

const Metric = ({ icon: Icon, label, value, note, tone = 'indigo' }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', blue: 'bg-blue-50 text-blue-600',
  };
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4.5 w-4.5" /></span><p className="mt-3 font-poppins text-[24px] font-bold text-slate-950">{value}</p><p className="text-[12px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</p>{note && <p className="mt-1 text-[12px] text-slate-400">{note}</p>}</div>;
};

export const AttendanceManagement = () => {
  const location = useLocation();
  const today = new Date().toLocaleDateString('en-CA');
  const currentMonth = today.slice(0, 7);
  const routeTab = location.pathname.endsWith('/view') ? 'view' : location.pathname.endsWith('/reports') ? 'reports' : 'mark';
  const [tab, setTab] = useState(routeTab);
  const [structure, setStructure] = useState({ classes: [] });
  const [attendanceRole, setAttendanceRole] = useState('student');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [page, setPage] = useState(1);
  const [overview, setOverview] = useState(null);
  const [overviewOpen, setOverviewOpen] = useState('pending');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [success, setSuccess] = useState(null);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [auditRecord, setAuditRecord] = useState(null);
  const [viewFilters, setViewFilters] = useState({ role: 'student', date: today, className: '', section: '', status: '', search: '' });
  const [reportFilters, setReportFilters] = useState({ role: 'student', month: currentMonth, className: '', section: '', status: '', search: '' });

  useEffect(() => { setTab(routeTab); setCorrectionMode(false); setCorrectionReason(''); }, [routeTab]);
  useEffect(() => { api.get('/academic-structure').then(({ data }) => setStructure(data || { classes: [] })).catch(() => setNotice('Academic Setup could not be loaded.')); }, []);

  const classes = structure.classes || [];
  const sectionsFor = (value) => classes.find((item) => item.name === value)?.sections || [];

  const loadOverview = useCallback(async () => {
    try { const { data } = await api.get('/attendance/overview', { params: { attendance_date: attendanceDate } }); setOverview(data); }
    catch (error) { setNotice(error.response?.data?.detail || 'Today’s attendance overview could not be loaded.'); }
  }, [attendanceDate]);

  useEffect(() => { if (tab === 'mark') loadOverview(); }, [tab, loadOverview]);

  const loadRoster = useCallback(async () => {
    if (attendanceRole === 'student' && (!className || !section)) { setRoster([]); setStatuses({}); return; }
    setLoading(true); setNotice('');
    try {
      const { data } = await api.get('/attendance/roster', { params: { attendance_role: attendanceRole, attendance_date: attendanceDate, class_name: className, section } });
      setRoster(data || []);
      setStatuses(Object.fromEntries((data || []).map((person) => [person.id, person.status || 'Not marked'])));
    } catch (error) { setNotice(error.response?.data?.detail || 'Attendance roster could not be loaded.'); }
    finally { setLoading(false); }
  }, [attendanceRole, attendanceDate, className, section]);

  useEffect(() => { if (tab === 'mark') loadRoster(); }, [tab, loadRoster]);
  useEffect(() => { setSelectedIds([]); setPage(1); }, [roster, rosterSearch]);

  const queryRecords = useCallback(async (mode = tab) => {
    const source = mode === 'reports' ? reportFilters : viewFilters;
    const bounds = mode === 'reports' ? monthBounds(source.month) : { from: source.date, to: source.date };
    setLoading(true); setNotice('');
    try {
      const { data } = await api.get('/attendance/records', { params: {
        attendance_role: source.role, date_from: bounds.from, date_to: bounds.to,
        class_name: source.role === 'student' ? source.className : '',
        section: source.role === 'student' ? source.section : '', status: source.status,
      } });
      setRecords(data || []);
    } catch (error) { setNotice(error.response?.data?.detail || 'Saved attendance could not be loaded.'); }
    finally { setLoading(false); }
  }, [tab, reportFilters, viewFilters]);

  // Filters apply only when the user asks for a refreshed register/report.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'view' || tab === 'reports') queryRecords(tab); }, [tab]);

  const visibleRecords = useMemo(() => {
    const term = (tab === 'reports' ? reportFilters.search : viewFilters.search).trim().toLowerCase();
    return !term ? records : records.filter((row) => [row.entity_name, row.class_name, row.section].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [records, reportFilters.search, viewFilters.search, tab]);

  const summary = useMemo(() => ['Present', 'Absent', 'Late', 'Leave', 'Not marked'].reduce((all, key) => ({ ...all, [key]: roster.filter((person) => (statuses[person.id] || 'Not marked') === key).length }), {}), [roster, statuses]);
  const unmarked = summary['Not marked'] || 0;
  const dayBlocked = overview?.day_status && !overview.day_status.is_working_day;

  const filteredRoster = useMemo(() => {
    const term = rosterSearch.trim().toLowerCase();
    return !term ? roster : roster.filter((person) => `${person.name} ${person.roll || ''} ${person.id}`.toLowerCase().includes(term));
  }, [roster, rosterSearch]);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredRoster.length / pageSize));
  const displayedRoster = filteredRoster.slice((page - 1) * pageSize, page * pageSize);
  const allDisplayedSelected = displayedRoster.length > 0 && displayedRoster.every((person) => selectedIds.includes(person.id));

  const setMany = (ids, status) => setStatuses((current) => ({ ...current, ...Object.fromEntries(roster.filter((person) => ids.includes(person.id) && !person.leave_locked).map((person) => [person.id, status])) }));
  const markAll = (status) => setMany(roster.map((person) => person.id), status);
  const markSelected = (status) => setMany(selectedIds, status);
  const toggleDisplayed = () => setSelectedIds((current) => allDisplayedSelected ? current.filter((id) => !displayedRoster.some((person) => person.id === id)) : [...new Set([...current, ...displayedRoster.filter((person) => !person.leave_locked).map((person) => person.id)])]);

  const prepareSubmit = () => {
    if (!roster.length) return setNotice('Choose a valid role and group first.');
    if (dayBlocked) return setNotice(`Attendance cannot be marked: ${overview.day_status.reason}.`);
    if (unmarked) return setNotice(`${unmarked} ${roleTitle(attendanceRole).toLowerCase()} still need an attendance status.`);
    if (correctionMode && !correctionReason.trim()) return setNotice('Enter a correction reason before saving changes.');
    setNotice(''); setConfirmOpen(true);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/attendance/mark', {
        attendance_role: attendanceRole, attendance_date: attendanceDate, class_name: className, section,
        allow_correction: correctionMode, correction_reason: correctionReason.trim(),
        entries: roster.map((person) => ({ entity_id: person.id, status: statuses[person.id] })),
      });
      setConfirmOpen(false); setSuccess(data); setCorrectionMode(false); setCorrectionReason('');
      await Promise.all([loadRoster(), loadOverview()]);
    } catch (error) { setConfirmOpen(false); setNotice(error.response?.data?.detail || 'Attendance could not be saved.'); }
    finally { setLoading(false); }
  };

  const startCorrection = async (group) => {
    setAttendanceRole(group.role); setAttendanceDate(group.date); setClassName(group.className || ''); setSection(group.section || '');
    setCorrectionMode(true); setCorrectionReason(''); setTab('mark'); setNotice('');
  };

  const recordGroups = useMemo(() => Object.values(visibleRecords.reduce((all, row) => {
    const key = `${row.attendance_role}|${row.attendance_date}|${row.class_name || ''}|${row.section || ''}`;
    const group = all[key] || { key, role: row.attendance_role, date: row.attendance_date, className: row.class_name, section: row.section, total: 0, present: 0, absent: 0, late: 0, leave: 0 };
    group.total += 1; group[String(row.status || '').toLowerCase()] = (group[String(row.status || '').toLowerCase()] || 0) + 1; all[key] = group; return all;
  }, {})), [visibleRecords]);

  const reportPeople = useMemo(() => Object.values(visibleRecords.reduce((all, row) => {
    const item = all[row.entity_id] || { id: row.entity_id, name: row.entity_name, className: row.class_name, section: row.section, present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    item.total += 1; item[String(row.status || '').toLowerCase()] = (item[String(row.status || '').toLowerCase()] || 0) + 1; all[row.entity_id] = item; return all;
  }, {})), [visibleRecords]);

  const reportTotals = useMemo(() => visibleRecords.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {}), [visibleRecords]);
  const reportRate = visibleRecords.length ? Math.round((((reportTotals.Present || 0) + (reportTotals.Late || 0)) / visibleRecords.length) * 1000) / 10 : null;

  const exportReport = () => downloadCSV(`attendance-${reportFilters.month}.csv`, ['Name', 'Class', 'Section', 'Present', 'Absent', 'Late', 'Approved Leave', 'Marked days', 'Attendance %'], reportPeople.map((person) => [person.name, person.className || '—', person.section || '—', person.present, person.absent, person.late, person.leave, person.total, `${person.total ? Math.round(((person.present + person.late) / person.total) * 1000) / 10 : 0}%`]));

  return <Layout>
    <PageTitle title={tab === 'mark' ? 'Add Attendance' : tab === 'view' ? 'View Attendance' : 'Attendance Reports'} subtitle={tab === 'mark' ? 'Complete today’s register safely, with approved leave and school-calendar rules already applied.' : tab === 'view' ? 'Review saved registers, correct mistakes with a reason and retain the complete history.' : 'Understand class-wise attendance with Present, Absent, Late and Approved Leave shown separately.'} />
    {notice && <div className="mb-5 flex items-start justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800"><span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{notice}</span><button onClick={() => setNotice('')}><X className="h-4 w-4" /></button></div>}

    {tab === 'mark' && <>
      <section className="mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 text-white shadow-[0_24px_60px_rgba(49,46,129,.22)]">
        <div className="flex flex-col justify-between gap-6 p-6 xl:flex-row xl:items-end">
          <div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[.16em] text-indigo-100"><Sparkles className="h-3.5 w-3.5" />Today’s Attendance Control Centre</span><h2 className="mt-4 font-poppins text-[26px] font-bold">Know what is complete before the school day moves ahead.</h2><p className="mt-2 max-w-2xl text-[13px] leading-5 text-indigo-100/65">Class registers, absences, approved leave, late arrivals and recurring absence are connected in one operational view.</p></div>
          <div className={`rounded-2xl border px-4 py-3 ${dayBlocked ? 'border-rose-300/20 bg-rose-400/10 text-rose-100' : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'}`}><p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider">{dayBlocked ? <CalendarOff className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}{overview?.day_status?.weekday || 'Calendar'}</p><p className="mt-1 text-[13px]">{overview?.day_status?.reason || 'Checking school calendar…'}</p></div>
        </div>
        <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-3 xl:grid-cols-6">{[
          ['Completed', overview?.groups_completed?.length || 0, CheckCircle2, 'text-emerald-300'], ['Still unmarked', overview?.groups_pending?.length || 0, Hourglass, 'text-amber-300'],
          ['Absent today', overview?.absent || 0, UserRoundX, 'text-rose-300'], ['Approved leave', overview?.leave || 0, ShieldCheck, 'text-blue-300'],
          ['Late today', overview?.late || 0, Clock, 'text-amber-300'], ['Recurring absence', overview?.recurring_absence?.length || 0, AlertTriangle, 'text-orange-300'],
        ].map(([label, value, Icon, tone]) => <button key={label} onClick={() => setOverviewOpen(label === 'Completed' ? 'completed' : label === 'Still unmarked' ? 'pending' : label === 'Recurring absence' ? 'recurring' : '')} className="border-r border-white/10 px-4 py-4 text-left transition hover:bg-white/[.06]"><Icon className={`h-4 w-4 ${tone}`} /><p className="mt-2 font-poppins text-[20px] font-bold">{value}</p><p className="text-[12px] font-bold uppercase tracking-wider text-indigo-100/50">{label}</p></button>)}</div>
      </section>

      {overviewOpen && <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[12px] font-bold uppercase tracking-wider text-indigo-600">{overviewOpen === 'completed' ? 'Completed registers' : overviewOpen === 'pending' ? 'Registers still unmarked' : 'Recurring absence · last 30 days'}</p><p className="mt-1 text-[12px] text-slate-400">{overviewOpen === 'recurring' ? 'Three or more absences are shown for follow-up.' : 'Select a class and section below to work on its register.'}</p></div><button onClick={() => setOverviewOpen('')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X className="h-4 w-4" /></button></div><div className="mt-3 flex flex-wrap gap-2">{((overviewOpen === 'completed' ? overview?.groups_completed : overviewOpen === 'pending' ? overview?.groups_pending : overview?.recurring_absence) || []).map((item, index) => <button key={`${item.class_name}-${item.section}-${item.student_id || index}`} onClick={() => { if (overviewOpen !== 'recurring') { setAttendanceRole('student'); setClassName(item.class_name); setSection(item.section); } }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">{overviewOpen === 'recurring' ? `${item.student_name} · ${item.class_name} ${item.section} · ${item.absence_count} absences` : `${item.class_name} · ${item.section}`}</button>)}{!(overviewOpen === 'completed' ? overview?.groups_completed : overviewOpen === 'pending' ? overview?.groups_pending : overview?.recurring_absence)?.length && <p className="text-[13px] text-slate-400">Nothing needs attention here.</p>}</div></div>}

      {correctionMode && <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-end"><div className="flex-1"><p className="flex items-center gap-2 text-[13px] font-bold text-violet-900"><PencilLine className="h-4 w-4" />Correction mode</p><p className="mt-1 text-[12px] text-violet-600">The original register remains in audit history. Explain why this correction is required.</p><input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Required correction reason" className="mt-3 h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-[13px] outline-none focus:border-violet-400" /></div><button onClick={() => { setCorrectionMode(false); setCorrectionReason(''); }} className="h-11 rounded-xl border border-violet-200 bg-white px-4 text-[13px] font-bold text-violet-700">Cancel correction</button></div></div>}

      <Card title="Choose the register" subtitle="No student is marked automatically. Use Mark all present only after the class register is ready.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
          <FieldSelect label="Role" value={attendanceRole} onChange={(value) => { setAttendanceRole(value); setClassName(''); setSection(''); }} options={[['student', 'Students'], ['teacher', 'Teachers'], ['staff', 'Staff']]} className="lg:col-span-2" />
          {attendanceRole === 'student' && <><FieldSelect label="Class" value={className} onChange={(value) => { setClassName(value); setSection(''); }} options={classes.map((item) => [item.name, item.name])} placeholder="Select class" className="lg:col-span-2" /><FieldSelect label="Section" value={section} onChange={setSection} options={sectionsFor(className).map((item) => [item.name, item.name])} placeholder="Select section" className="lg:col-span-2" /></>}
          <label className={`${attendanceRole === 'student' ? 'lg:col-span-2' : 'lg:col-span-3'} text-[12px] font-bold uppercase tracking-wider text-slate-500`}>Attendance date<input type="date" max={today} value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300" /></label>
          <label className={`${attendanceRole === 'student' ? 'lg:col-span-2' : 'lg:col-span-3'} relative text-[12px] font-bold uppercase tracking-wider text-slate-500`}>Search<input value={rosterSearch} onChange={(event) => setRosterSearch(event.target.value)} placeholder={`Search ${roleTitle(attendanceRole).toLowerCase()}`} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-[13px] outline-none focus:border-indigo-300" /><Search className="absolute bottom-3 right-3 h-4 w-4 text-slate-400" /></label>
          <button disabled={!roster.length || dayBlocked} onClick={() => markAll('Present')} className="h-11 rounded-xl bg-emerald-600 px-3 text-[13px] font-bold text-white disabled:opacity-40 lg:col-span-2"><UserCheck className="mr-2 inline h-4 w-4" />Mark all present</button>
        </div>
      </Card>

      {roster.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{[['Present', summary.Present, CheckCircle2, 'emerald'], ['Absent', summary.Absent, XCircle, 'rose'], ['Late', summary.Late, Clock, 'amber'], ['Approved Leave', summary.Leave, ShieldCheck, 'blue'], ['Not marked', unmarked, Hourglass, 'indigo']].map(([label, value, Icon, tone]) => <Metric key={label} icon={Icon} label={label} value={value} tone={tone} />)}</div>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-5 py-3"><span className="mr-2 text-[12px] font-bold text-indigo-700">{selectedIds.length} selected</span>{['Present', 'Absent', 'Late'].map((status) => <button key={status} onClick={() => markSelected(status)} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[12px] font-bold text-indigo-700">Mark {status}</button>)}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="w-12 px-5 py-4"><input type="checkbox" checked={allDisplayedSelected} onChange={toggleDisplayed} /></th><th className="w-16 py-4">No.</th><th className="py-4">{attendanceRole === 'student' ? 'Student' : roleTitle(attendanceRole).slice(0, -1)}</th><th className="py-4">Current status</th><th className="px-5 py-4 text-right">Mark attendance</th></tr></thead><tbody>{displayedRoster.map((person, index) => { const current = statuses[person.id] || 'Not marked'; const leaveLabel = attendanceRole === 'student' ? 'Approved Parent App leave' : attendanceRole === 'teacher' ? 'Approved teacher leave' : 'Approved staff leave'; return <tr key={person.id} className={`border-t border-slate-50 ${person.leave_locked ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}><td className="px-5 py-3"><input type="checkbox" disabled={person.leave_locked} checked={selectedIds.includes(person.id)} onChange={() => setSelectedIds((items) => items.includes(person.id) ? items.filter((id) => id !== person.id) : [...items, person.id])} /></td><td className="py-3 text-[13px] text-slate-400">{String((page - 1) * pageSize + index + 1).padStart(2, '0')}</td><td className="py-3"><div className="flex items-center gap-3">{person.avatar ? <img src={person.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[12px] font-bold text-indigo-600">{initials(person.name)}</span>}<div><p className="text-[13px] font-bold text-slate-800">{person.name}</p><p className="mt-0.5 text-[12px] text-slate-400">{person.roll ? `Roll ${person.roll}` : person.id}</p>{person.leave_locked && <p className="mt-1 text-[12px] font-semibold text-blue-600">{leaveLabel}{person.leave_reason ? ` · ${person.leave_reason}` : ''}</p>}</div></div></td><td className="py-3"><StatusPill status={current} /></td><td className="px-5 py-3 text-right">{person.leave_locked ? <span className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-bold text-blue-700">Leave · locked</span> : <span className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">{['Present', 'Absent', 'Late'].map((status) => <button key={status} onClick={() => setStatuses((items) => ({ ...items, [person.id]: status }))} className={`border-l border-slate-200 px-3 py-2 text-[12px] font-bold first:border-l-0 ${current === status ? STATUS_META[status].tone : 'text-slate-400 hover:bg-slate-50'}`}>{status}</button>)}</span>}</td></tr>; })}</tbody></table></div>
        {!loading && !roster.length && <div className="py-14 text-center"><CalendarCheck className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-[13px] font-semibold text-slate-500">{attendanceRole === 'student' ? 'Choose Class and Section to load the active student register.' : `No active ${roleTitle(attendanceRole).toLowerCase()} were found.`}</p></div>}
        {roster.length > 0 && <div className="flex flex-col gap-4 border-t border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-[12px] text-slate-400">Showing {displayedRoster.length} of {filteredRoster.length} · {unmarked ? `${unmarked} not marked` : 'Register complete'}</p><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg px-3 py-2 text-slate-500 disabled:opacity-30">‹</button><span className="text-[12px] font-bold text-slate-600">{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg px-3 py-2 text-slate-500 disabled:opacity-30">›</button><Btn icon={correctionMode ? PencilLine : Save} onClick={prepareSubmit} disabled={loading || dayBlocked}>{correctionMode ? 'Save correction' : 'Review & submit'}</Btn></div></div>}
      </div>
    </>}

    {tab === 'view' && <>
      <FilterPanel title="Find a saved register" subtitle="Filter the exact school register before reviewing or correcting it.">
        <FieldSelect label="Role" value={viewFilters.role} onChange={(value) => setViewFilters((item) => ({ ...item, role: value, className: '', section: '' }))} options={[['student', 'Students'], ['teacher', 'Teachers'], ['staff', 'Staff']]} />
        {viewFilters.role === 'student' && <><FieldSelect label="Class" value={viewFilters.className} onChange={(value) => setViewFilters((item) => ({ ...item, className: value, section: '' }))} options={classes.map((item) => [item.name, item.name])} placeholder="All classes" /><FieldSelect label="Section" value={viewFilters.section} onChange={(value) => setViewFilters((item) => ({ ...item, section: value }))} options={sectionsFor(viewFilters.className).map((item) => [item.name, item.name])} placeholder="All sections" /></>}
        <FieldDate label="Date" value={viewFilters.date} onChange={(value) => setViewFilters((item) => ({ ...item, date: value }))} />
        <FieldSelect label="Status" value={viewFilters.status} onChange={(value) => setViewFilters((item) => ({ ...item, status: value }))} options={['Present', 'Absent', 'Late', 'Leave'].map((value) => [value, value === 'Leave' ? 'Approved Leave' : value])} placeholder="All statuses" />
        <FieldSearch value={viewFilters.search} onChange={(value) => setViewFilters((item) => ({ ...item, search: value }))} placeholder="Search name" />
        <Btn onClick={() => queryRecords('view')} className="h-11">Load attendance</Btn>
      </FilterPanel>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">{recordGroups.map((group) => <div key={group.key} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[12px] font-bold uppercase tracking-wider text-indigo-600">{group.role === 'student' ? `${group.className} · ${group.section}` : roleTitle(group.role)}</p><h3 className="mt-1 text-[14px] font-bold text-slate-900">{group.date}</h3><p className="mt-1 text-[12px] text-slate-400">Originally saved by the authorised school user</p></div><button onClick={() => startCorrection(group)} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-bold text-violet-700"><PencilLine className="h-3.5 w-3.5" />Correct register</button></div><div className="mt-4 grid grid-cols-4 gap-2">{[['Present', group.present, 'text-emerald-600'], ['Absent', group.absent, 'text-rose-600'], ['Late', group.late, 'text-amber-600'], ['Leave', group.leave, 'text-blue-600']].map(([label, value, tone]) => <div key={label} className="rounded-xl bg-slate-50 p-2.5"><p className={`text-[15px] font-bold ${tone}`}>{value || 0}</p><p className="text-[12px] uppercase text-slate-400">{label}</p></div>)}</div></div>)}</div>
      <SavedRecords records={visibleRecords} onAudit={setAuditRecord} />
    </>}

    {tab === 'reports' && <>
      <FilterPanel title="Class-wise monthly attendance" subtitle="Late counts as attended. Approved Leave remains part of total working days and is shown separately.">
        <FieldSelect label="Role" value={reportFilters.role} onChange={(value) => setReportFilters((item) => ({ ...item, role: value, className: '', section: '' }))} options={[['student', 'Students'], ['teacher', 'Teachers'], ['staff', 'Staff']]} />
        {reportFilters.role === 'student' && <><FieldSelect label="Class" value={reportFilters.className} onChange={(value) => setReportFilters((item) => ({ ...item, className: value, section: '' }))} options={classes.map((item) => [item.name, item.name])} placeholder="All classes" /><FieldSelect label="Section" value={reportFilters.section} onChange={(value) => setReportFilters((item) => ({ ...item, section: value }))} options={sectionsFor(reportFilters.className).map((item) => [item.name, item.name])} placeholder="All sections" /></>}
        <label className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Month<input type="month" value={reportFilters.month} onChange={(event) => setReportFilters((item) => ({ ...item, month: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px]" /></label>
        <FieldSelect label="Status" value={reportFilters.status} onChange={(value) => setReportFilters((item) => ({ ...item, status: value }))} options={['Present', 'Absent', 'Late', 'Leave'].map((value) => [value, value === 'Leave' ? 'Approved Leave' : value])} placeholder="All statuses" />
        <FieldSearch value={reportFilters.search} onChange={(value) => setReportFilters((item) => ({ ...item, search: value }))} placeholder="Search name" />
        <Btn onClick={() => queryRecords('reports')} className="h-11">Apply filters</Btn>
      </FilterPanel>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><Metric icon={Users} label={roleTitle(reportFilters.role)} value={reportPeople.length} tone="indigo" /><Metric icon={CheckCircle2} label="Present" value={reportTotals.Present || 0} tone="emerald" /><Metric icon={XCircle} label="Absent" value={reportTotals.Absent || 0} tone="rose" /><Metric icon={Clock} label="Late" value={reportTotals.Late || 0} tone="amber" /><Metric icon={ShieldCheck} label="Approved Leave" value={reportTotals.Leave || 0} tone="blue" /><Metric icon={CalendarCheck} label="Attendance rate" value={reportRate === null ? '—' : `${reportRate}%`} note="(Present + Late) ÷ all marked working days" tone="indigo" /></div>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Btn variant="outline" icon={Download} onClick={exportReport}>Export CSV</Btn><Btn icon={FileText} onClick={printPage}>Export PDF</Btn></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="text-[15px] font-bold text-slate-900">Attendance performance detail</h3><p className="mt-1 text-[12px] text-slate-400">Every status is visible, so the percentage can be checked without hidden numbers.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Name</th><th>Present</th><th>Absent</th><th>Late</th><th>Approved Leave</th><th>Marked days</th><th className="px-5 text-right">Attendance %</th></tr></thead><tbody>{reportPeople.map((person) => { const rate = person.total ? Math.round(((person.present + person.late) / person.total) * 1000) / 10 : 0; return <tr key={person.id} className="border-t border-slate-50"><td className="px-5 py-4"><p className="text-[13px] font-bold text-slate-800">{person.name}</p><p className="text-[12px] text-slate-400">{person.className ? `${person.className} · ${person.section}` : person.id}</p></td><td className="text-[13px] font-bold text-emerald-600">{person.present}</td><td className="text-[13px] font-bold text-rose-600">{person.absent}</td><td className="text-[13px] font-bold text-amber-600">{person.late}</td><td className="text-[13px] font-bold text-blue-600">{person.leave}</td><td className="text-[13px] font-bold text-slate-700">{person.total}</td><td className="px-5 text-right"><span className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${rate >= 90 ? 'bg-emerald-50 text-emerald-700' : rate >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{rate}%</span></td></tr>; })}</tbody></table></div>{!reportPeople.length && <Empty text="No attendance matches these filters." />}</div>
    </>}

    {confirmOpen && <Modal onClose={() => setConfirmOpen(false)}><div className="text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><ShieldCheck className="h-7 w-7" /></span><p className="mt-4 text-[12px] font-bold uppercase tracking-[.15em] text-indigo-600">Final register check</p><h2 className="mt-1 font-poppins text-[21px] font-bold text-slate-950">{correctionMode ? 'Save this attendance correction?' : 'Submit this attendance register?'}</h2><p className="mt-2 text-[13px] leading-5 text-slate-500">{roleTitle(attendanceRole)} · {attendanceRole === 'student' ? `${className} ${section} · ` : ''}{attendanceDate}</p></div><div className="mt-5 grid grid-cols-4 gap-2">{[['Present', summary.Present, 'text-emerald-600'], ['Absent', summary.Absent, 'text-rose-600'], ['Late', summary.Late, 'text-amber-600'], ['Leave', summary.Leave, 'text-blue-600']].map(([label, value, tone]) => <div key={label} className="rounded-xl bg-slate-50 p-3 text-center"><p className={`text-[18px] font-bold ${tone}`}>{value}</p><p className="text-[12px] uppercase text-slate-400">{label}</p></div>)}</div>{correctionMode && <div className="mt-4 rounded-xl bg-violet-50 p-3 text-[12px] text-violet-700"><b>Correction reason:</b> {correctionReason}</div>}<div className="mt-6 flex justify-end gap-2"><Btn variant="outline" onClick={() => setConfirmOpen(false)}>Go back</Btn><Btn icon={correctionMode ? PencilLine : Save} onClick={submit} disabled={loading}>{loading ? 'Saving…' : correctionMode ? 'Confirm correction' : 'Confirm & submit'}</Btn></div></Modal>}
    {success && <Modal onClose={() => setSuccess(null)}><div className="text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></span><h2 className="mt-4 font-poppins text-[21px] font-bold">Attendance saved successfully</h2><p className="mt-2 text-[13px] leading-5 text-slate-500">{success.saved} records were saved for {success.attendance_date}. The register and its audit history are available in View Attendance.</p>{success.parent_notifications > 0 && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-[12px] font-semibold text-blue-700">{success.parent_notifications} parent absence notification(s) were queued.</p>}<Btn className="mt-5" onClick={() => setSuccess(null)}>Done</Btn></div></Modal>}
    {auditRecord && <Modal onClose={() => setAuditRecord(null)}><div className="flex items-start justify-between"><div><p className="text-[12px] font-bold uppercase tracking-wider text-indigo-600">Complete audit history</p><h2 className="mt-1 text-[19px] font-bold text-slate-950">{auditRecord.entity_name}</h2><p className="mt-1 text-[12px] text-slate-400">{auditRecord.attendance_date} · {auditRecord.class_name ? `${auditRecord.class_name} ${auditRecord.section}` : roleTitle(auditRecord.attendance_role)}</p></div><button onClick={() => setAuditRecord(null)}><X className="h-5 w-5 text-slate-400" /></button></div><div className="mt-5 space-y-3">{(auditRecord.audit_history || []).slice().reverse().map((item, index) => <div key={`${item.at}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-[13px] font-bold text-slate-800">{item.action}</p><p className="text-[12px] text-slate-400">{item.at ? new Date(item.at).toLocaleString('en-IN') : '—'}</p></div><p className="mt-1 text-[12px] text-slate-500">By {item.by || 'School user'}{item.previous_status ? ` · ${item.previous_status} → ${item.new_status}` : ` · ${item.new_status}`}</p>{item.reason && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[12px] text-violet-700">Reason: {item.reason}</p>}</div>)}{!auditRecord.audit_history?.length && <p className="rounded-xl bg-slate-50 p-4 text-[12px] text-slate-500">This older record has no detailed history. Future changes will be recorded here.</p>}</div></Modal>}
  </Layout>;
};

const FilterPanel = ({ title, subtitle, children }) => <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div><h2 className="text-[15px] font-bold text-slate-900">{title}</h2><p className="mt-1 text-[12px] text-slate-400">{subtitle}</p></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7 xl:items-end">{children}</div></div>;
const FieldSelect = ({ label, value, onChange, options, placeholder, className = '' }) => <label className={`${className} text-[12px] font-bold uppercase tracking-wider text-slate-500`}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300">{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map(([itemValue, itemLabel]) => <option key={itemValue} value={itemValue}>{itemLabel}</option>)}</select></label>;
const FieldDate = ({ label, value, onChange }) => <label className="text-[12px] font-bold uppercase tracking-wider text-slate-500">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px]" /></label>;
const FieldSearch = ({ value, onChange, placeholder }) => <label className="relative text-[12px] font-bold uppercase tracking-wider text-slate-500">Search<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-[13px]" /><Search className="absolute bottom-3 right-3 h-4 w-4 text-slate-400" /></label>;
const Empty = ({ text }) => <div className="py-12 text-center"><CalendarOff className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-[13px] font-semibold text-slate-500">{text}</p></div>;
const Modal = ({ children, onClose }) => <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl">{children}</div></div>;

const SavedRecords = ({ records, onAudit }) => <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="text-[15px] font-bold text-slate-900">Saved attendance records</h3><p className="mt-1 text-[12px] text-slate-400">Open History to see the original entry and every later correction.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[12px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Date</th><th>Name</th><th>Class / Section</th><th>Status</th><th>Originally marked by</th><th>Last updated by</th><th className="px-5 text-right">Audit</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-50"><td className="px-5 py-4 text-[13px] text-slate-600">{record.attendance_date}</td><td className="text-[13px] font-bold text-slate-800">{record.entity_name}</td><td className="text-[12px] text-slate-500">{record.class_name ? `${record.class_name} · ${record.section}` : '—'}</td><td><StatusPill status={record.status} /></td><td className="text-[12px] text-slate-500">{record.created_by || record.updated_by || '—'}<span className="block text-[12px] text-slate-400">{record.created_at ? new Date(record.created_at).toLocaleString('en-IN') : 'Legacy record'}</span></td><td className="text-[12px] text-slate-500">{record.updated_by || '—'}<span className="block text-[12px] text-slate-400">{record.updated ? new Date(record.updated).toLocaleString('en-IN') : '—'}</span></td><td className="px-5 text-right"><button onClick={() => onAudit(record)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"><History className="h-3.5 w-3.5" />History</button></td></tr>)}</tbody></table></div>{!records.length && <Empty text="No saved attendance matches these filters." />}</div>;

export default AttendanceManagement;
