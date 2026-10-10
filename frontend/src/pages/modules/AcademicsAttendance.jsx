import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table, ProgressBar } from '../../components/Shared';
import { BookOpen, GraduationCap, Percent, Users, CalendarCheck, CheckCircle2, XCircle, Clock, Plus, Download, FileText, Save, Search } from 'lucide-react';
import { filterRows, downloadCSV, printPage } from '../../utils';

export const AcademicsManagement = () => {
  const subjects = [
    { name: 'Mathematics', teacher: 'Vikram Nair', classes: 8, avg: 82 },
    { name: 'Physics', teacher: 'Dr. Anita Rao', classes: 5, avg: 78 },
    { name: 'Chemistry', teacher: 'Rahul Menon', classes: 6, avg: 74 },
    { name: 'Biology', teacher: 'Priya Das', classes: 4, avg: 80 },
    { name: 'English', teacher: 'Sneha Kapoor', classes: 9, avg: 85 },
    { name: 'Computer Science', teacher: 'Arjun Sethi', classes: 5, avg: 88 },
  ];
  const [q, setQ] = useState('');
  const rows = filterRows(subjects, q, ['name', 'teacher']);
  const exportCSV = () => downloadCSV('subjects.csv', ['Subject', 'Teacher', 'Classes', 'Avg'], rows.map((s) => [s.name, s.teacher, s.classes, s.avg]));
  return (
    <Layout>
      <PageTitle title="Academics Management" subtitle="Manage curriculum, subjects, and class performance."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Subject</Btn></>} />
      <StatCards items={[
        { label: 'Total Subjects', value: '24', icon: BookOpen, delta: '+2' },
        { label: 'Active Classes', value: '38', icon: GraduationCap, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Avg. Performance', value: '81.4%', icon: Percent, tint: 'bg-green-50 text-green-600', delta: '+3.1%' },
        { label: 'Enrolled Students', value: '1,284', icon: Users, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <Card title="Subjects Overview" action={<SearchBar placeholder="Search subjects..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Subject'},{label:'Lead Teacher'},{label:'Classes'},{label:'Avg. Score'},{label:'Performance'}]}>
          {rows.map((s) => (
            <tr key={s.name} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{s.name}</td>
              <td className="py-3 text-[13px] text-[#666]">{s.teacher}</td>
              <td className="py-3 text-[13px] text-[#666]">{s.classes}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{s.avg}%</td>
              <td className="py-3 w-48"><ProgressBar value={s.avg} color={s.avg>=85?'bg-green-500':s.avg>=75?'bg-[#4F46E5]':'bg-amber-500'} /></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[13px] text-[#999]">No subjects found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const AttendanceManagement = () => {
  const location = useLocation();
  const today = new Date().toISOString().slice(0, 10);
  const pathTab = location.pathname.endsWith('/view') ? 'view' : location.pathname.endsWith('/reports') ? 'reports' : 'mark';
  const [tab, setTab] = useState(pathTab);
  const [attendanceRole, setAttendanceRole] = useState('student');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [structure, setStructure] = useState({ classes: [] });
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [reportFrom, setReportFrom] = useState(today);
  const [reportTo, setReportTo] = useState(today);
  const [reportRole, setReportRole] = useState('student');
  const [reportSearch, setReportSearch] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [successModal, setSuccessModal] = useState(null);
  useEffect(() => { setTab(pathTab); }, [pathTab]);
  const loadSetup = useCallback(async () => setStructure((await api.get('/academic-structure')).data || { classes: [] }), []);
  useEffect(() => { loadSetup().catch(() => setNotice('Could not load Academic Setup.')); }, [loadSetup]);
  const selectedClass = (structure.classes || []).find((item) => item.name === className);
  const sections = selectedClass?.sections || [];
  const loadRoster = useCallback(async () => {
    if (attendanceRole === 'student' && (!className || !section)) { setRoster([]); setStatuses({}); return; }
    setLoading(true); setNotice('');
    try { const { data } = await api.get('/attendance/roster', { params: { attendance_role: attendanceRole, attendance_date: attendanceDate, class_name: className, section } }); setRoster(data); setStatuses(Object.fromEntries(data.map((person) => [person.id, person.status || 'Present']))); }
    catch (error) { setNotice(error.response?.data?.detail || 'Could not load the attendance list.'); }
    finally { setLoading(false); }
  }, [attendanceRole, attendanceDate, className, section]);
  useEffect(() => { if (tab === 'mark') loadRoster(); }, [loadRoster, tab]);
  const loadRecords = useCallback(async () => { try { const { data } = await api.get('/attendance/records', { params: { attendance_role: tab === 'reports' ? reportRole : attendanceRole, date_from: tab === 'reports' ? reportFrom : attendanceDate, date_to: tab === 'reports' ? reportTo : attendanceDate, class_name: attendanceRole === 'student' ? className : '', section: attendanceRole === 'student' ? section : '' } }); setRecords(data); } catch (_) { setNotice('Could not load saved attendance records.'); } }, [tab, reportRole, reportFrom, reportTo, attendanceRole, attendanceDate, className, section]);
  useEffect(() => { if (tab !== 'mark') loadRecords(); }, [tab, loadRecords]);
  useEffect(() => { setCurrentPage(1); setSelectedIds([]); }, [attendanceRole, className, section, roster]);
  const save = async () => { if (!roster.length) { setNotice('Choose a valid role and group, then load the attendance list.'); return; } setLoading(true); try { const response = await api.post('/attendance/mark', { attendance_role: attendanceRole, attendance_date: attendanceDate, class_name: className, section, entries: roster.map((person) => ({ entity_id: person.id, status: statuses[person.id] || 'Present' })) }); setNotice(''); setSuccessModal(response.data); await loadRoster(); } catch (error) { setNotice(error.response?.data?.detail || 'Could not save attendance.'); } finally { setLoading(false); } };
  const summary = useMemo(() => ({ present: records.filter((item) => item.status === 'Present').length, absent: records.filter((item) => item.status === 'Absent').length, late: records.filter((item) => item.status === 'Late').length, total: records.length }), [records]);
  const rate = summary.total ? Math.round(((summary.present + summary.late) / summary.total) * 100) : null;
  const csvRows = records.map((item) => [item.attendance_date, item.attendance_role, item.entity_name, item.class_name || '—', item.section || '—', item.status, item.updated_by || '—']);
  const roleLabel = attendanceRole === 'student' ? 'Students' : attendanceRole === 'teacher' ? 'Teachers' : 'Staff';
  const reportRoleLabel = reportRole === 'student' ? 'Students' : reportRole === 'teacher' ? 'Teachers' : 'Staff';
  const reportPeople = useMemo(() => Object.values(records.reduce((all, record) => {
    const current = all[record.entity_id] || { id: record.entity_id, name: record.entity_name, className: record.class_name, section: record.section, present: 0, absent: 0, total: 0 };
    current.total += 1;
    if (record.status === 'Present' || record.status === 'Late') current.present += 1;
    if (record.status === 'Absent') current.absent += 1;
    all[record.entity_id] = current;
    return all;
  }, {})), [records]);
  const filteredReportPeople = useMemo(() => reportPeople.filter((person) => person.name.toLowerCase().includes(reportSearch.trim().toLowerCase())), [reportPeople, reportSearch]);
  const reportPresent = records.filter((record) => record.status === 'Present' || record.status === 'Late').length;
  const reportAbsent = records.filter((record) => record.status === 'Absent').length;
  const reportRate = records.length ? Math.round((reportPresent / records.length) * 1000) / 10 : null;
  const filteredRoster = useMemo(() => roster.filter((person) => person.name.toLowerCase().includes(rosterSearch.trim().toLowerCase()) || String(person.roll || person.id).toLowerCase().includes(rosterSearch.trim().toLowerCase())), [roster, rosterSearch]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRoster.length / pageSize));
  const displayedRoster = filteredRoster.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allDisplayedSelected = displayedRoster.length > 0 && displayedRoster.every((person) => selectedIds.includes(person.id));
  const markAll = (status) => setStatuses((current) => ({ ...current, ...Object.fromEntries(roster.map((person) => [person.id, status])) }));
  const toggleSelected = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleDisplayed = () => setSelectedIds((current) => allDisplayedSelected ? current.filter((id) => !displayedRoster.some((person) => person.id === id)) : [...new Set([...current, ...displayedRoster.map((person) => person.id)])]);
  const pageHeading = tab === 'view' ? ['View Attendance', 'Review attendance that has already been saved.'] : tab === 'reports' ? ['Attendance Reports', 'Download saved attendance in CSV or PDF format.'] : ['Add Attendance', 'Mark real daily attendance for Students, Teachers and Staff.'];
  return <Layout>
    <PageTitle title={pageHeading[0]} subtitle={pageHeading[1]} />
    {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('successfully') ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{notice}</div>}
    {tab === 'mark' && <>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-end">
          <label className="xl:col-span-2 text-[12px] font-medium text-[#333]">Role section<select value={attendanceRole} onChange={(e) => { setAttendanceRole(e.target.value); setClassName(''); setSection(''); }} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px]"><option value="student">Student</option><option value="teacher">Teacher</option><option value="staff">Staff</option></select></label>
          {attendanceRole === 'student' && <><label className="xl:col-span-2 text-[12px] font-medium text-[#333]">Select class<select value={className} onChange={(e) => { setClassName(e.target.value); setSection(''); }} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px]"><option value="">Select class</option>{(structure.classes || []).map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></label><label className="xl:col-span-2 text-[12px] font-medium text-[#333]">Select section<select value={section} onChange={(e) => setSection(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px]"><option value="">Select section</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label></>}
          <label className={`${attendanceRole === 'student' ? 'xl:col-span-3' : 'xl:col-span-5'} relative text-[12px] font-medium text-[#333]`}>Search<input value={rosterSearch} onChange={(e) => { setRosterSearch(e.target.value); setCurrentPage(1); }} placeholder={`Search ${roleLabel.toLowerCase()}`} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-10 text-[13px]" /><Search size={18} className="absolute bottom-3 right-3 text-[#444]" /></label>
          <button type="button" onClick={() => markAll('Present')} disabled={!roster.length} className="h-11 rounded-lg bg-[#f4f7fb] px-4 text-[13px] font-semibold text-[#465569] disabled:cursor-not-allowed disabled:opacity-50">✓ Mark All Present</button><button type="button" onClick={() => markAll('Absent')} disabled={!roster.length} className="h-11 rounded-lg bg-[#f4f7fb] px-4 text-[13px] font-semibold text-[#465569] disabled:cursor-not-allowed disabled:opacity-50">× Mark All Absent</button>
        </div>
        <p className="mt-3 text-[12px] text-[#999]">Attendance date: {attendanceDate}. Change the date from View Attendance if you need to review another day.</p>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-gray-100 text-[12px] font-medium text-[#555]"><tr><th className="w-12 px-5 py-4"><input type="checkbox" checked={allDisplayedSelected} onChange={toggleDisplayed} /></th><th className="w-16 py-4">Sr.</th><th className="py-4">{attendanceRole === 'student' ? 'Student Name' : `${roleLabel.slice(0, -1)} Name`}</th><th className="py-4">Status</th><th className="px-5 py-4 text-right">Attendance Action</th></tr></thead><tbody>{displayedRoster.map((person, index) => { const currentStatus = statuses[person.id] || 'Present'; return <tr key={person.id} className="border-b border-gray-50 last:border-0"><td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => toggleSelected(person.id)} /></td><td className="py-4 text-[13px] text-[#888]">{String((currentPage - 1) * pageSize + index + 1).padStart(2, '0')}</td><td className="py-4 text-[13px] font-medium text-[#333]">{person.name}<span className="ml-2 text-[11px] font-normal text-[#999]">{attendanceRole === 'student' && person.roll ? `Roll ${person.roll}` : ''}</span></td><td className={`py-4 text-[13px] font-medium ${currentStatus === 'Present' ? 'text-green-600' : currentStatus === 'Absent' ? 'text-indigo-500' : 'text-amber-600'}`}>{currentStatus}</td><td className="px-5 py-3 text-right"><span className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-[#fafbfd]"><button type="button" onClick={() => setStatuses({ ...statuses, [person.id]: 'Absent' })} className={`px-3 py-2 text-[12px] font-semibold ${currentStatus === 'Absent' ? 'bg-indigo-50 text-indigo-600' : 'text-[#9aa7b8]'}`}>Absent</button><button type="button" onClick={() => setStatuses({ ...statuses, [person.id]: 'Present' })} className={`border-l border-gray-200 px-3 py-2 text-[12px] font-semibold ${currentStatus === 'Present' ? 'bg-green-50 text-green-600' : 'text-[#9aa7b8]'}`}>Present</button></span></td></tr>; })}</tbody></table></div>
        {!loading && !roster.length && <div className="py-12 text-center text-[13px] text-[#999]">{attendanceRole === 'student' ? 'Select Class and Section to load students.' : `No ${roleLabel.toLowerCase()} have been added yet.`}</div>}
        {roster.length > 0 && !displayedRoster.length && <div className="py-12 text-center text-[13px] text-[#999]">No {roleLabel.toLowerCase()} match this search.</div>}
        {roster.length > 0 && <div className="flex flex-col gap-4 border-t border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between"><span className="text-[12px] text-[#777]">Showing {displayedRoster.length} of {filteredRoster.length} {roleLabel}</span><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded px-3 py-2 text-[#777] disabled:opacity-30">‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button type="button" key={page} onClick={() => setCurrentPage(page)} className={`h-9 w-9 rounded text-[13px] font-semibold ${currentPage === page ? 'bg-[#4F46E5] text-white' : 'text-[#555]'}`}>{page}</button>)}<button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded px-3 py-2 text-[#777] disabled:opacity-30">›</button><Btn icon={Save} onClick={save} className="ml-3">{loading ? 'Saving…' : 'Submit Attendance'}</Btn></div></div>}
      </div>
    </>}
    {tab === 'view' && <><Card title="View saved attendance" subtitle="Only saved records for the selected date and role are shown."><div className="grid grid-cols-1 gap-4 md:grid-cols-4"><label className="text-[12px] font-medium text-[#555]">Role<select value={attendanceRole} onChange={(e) => setAttendanceRole(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]"><option value="student">Students</option><option value="teacher">Teachers</option><option value="staff">Staff</option></select></label><label className="text-[12px] font-medium text-[#555]">Date<input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]" /></label><Btn variant="outline" onClick={loadRecords} className="self-end">Load attendance</Btn></div></Card><AttendanceSummary summary={summary} rate={rate} /><AttendanceTable records={records} /></>}
    {tab === 'reports' && <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-poppins text-[26px] font-bold text-[#1a1a1a]">Attendance Reports</h2><p className="mt-1 text-[14px] text-[#777]">{reportFrom} — {reportTo}</p></div><div className="flex gap-2"><Btn variant="outline" icon={Download} onClick={() => downloadCSV(`attendance-report-${reportFrom}-to-${reportTo}.csv`, ['Name', 'Class', 'Section', 'Present days', 'Absent days', 'Attendance %'], filteredReportPeople.map((person) => [person.name, person.className || '—', person.section || '—', person.present, person.absent, person.total ? `${Math.round(person.present / person.total * 1000) / 10}%` : '—']))}>Export CSV</Btn><Btn icon={FileText} onClick={printPage}>Export PDF</Btn></div></div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3"><ReportMetric label={`Total ${reportRoleLabel}`} value={reportPeople.length} icon={Users} tint="bg-blue-50 text-blue-600" /><ReportMetric label="Present marks in period" value={reportPresent} suffix={reportRate === null ? '' : `${reportRate}%`} icon={CheckCircle2} tint="bg-green-50 text-green-600" /><ReportMetric label="Absent marks in period" value={reportAbsent} suffix={records.length ? `${Math.round(reportAbsent / records.length * 1000) / 10}%` : ''} icon={XCircle} tint="bg-indigo-50 text-[#4F46E5]" /></div>
      <div className="mt-6 rounded-2xl bg-[#f1f5f8] p-5"><div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-end"><label className="text-[12px] font-medium text-[#333]">Role Selection<select value={reportRole} onChange={(e) => setReportRole(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px]"><option value="student">Students</option><option value="teacher">Teachers</option><option value="staff">Staff</option></select></label><label className="text-[12px] font-medium text-[#333]">From date<input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px]" /></label><label className="text-[12px] font-medium text-[#333]">To date<input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px]" /></label><label className="relative text-[12px] font-medium text-[#333]">Search<input value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} placeholder={`Search ${reportRoleLabel.toLowerCase()}`} className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-10 text-[13px]" /><Search size={18} className="absolute bottom-3 right-3 text-[#444]" /></label><Btn onClick={loadRecords} className="h-11">Apply Filters</Btn></div></div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-100 px-6 py-5"><h3 className="font-poppins text-[18px] font-bold text-[#1a1a1a]">Attendance Performance Detail</h3><span className="text-[12px] text-[#888]"><span className="mr-3 text-green-600">● Present</span><span className="text-indigo-500">● Absent</span></span></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="bg-[#fafafa] text-[11px] uppercase tracking-wide text-[#777]"><tr><th className="px-6 py-4">{reportRole === 'student' ? 'Student Name' : `${reportRole.slice(0, 1).toUpperCase()}${reportRole.slice(1)} Name`}</th><th className="py-4">Present</th><th className="py-4">Absent</th><th className="px-6 py-4 text-right">Attendance %</th></tr></thead><tbody>{filteredReportPeople.map((person) => { const personRate = person.total ? Math.round(person.present / person.total * 1000) / 10 : 0; return <tr key={person.id} className="border-t border-gray-50"><td className="px-6 py-4"><p className="text-[13px] font-semibold text-[#333]">{person.name}</p><p className="mt-0.5 text-[11px] text-[#999]">{person.className ? `${person.className} · ${person.section}` : person.id}</p></td><td className="py-4 text-[14px] font-semibold text-[#333]">{person.present}</td><td className="py-4 text-[14px] font-semibold text-[#333]">{person.absent}</td><td className="px-6 py-4 text-right"><span className={`rounded-full px-3 py-1 text-[12px] font-bold ${personRate >= 90 ? 'bg-green-50 text-green-700' : personRate >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}>{personRate}%</span></td></tr>; })}</tbody></table></div>{!filteredReportPeople.length && <div className="py-12 text-center text-[13px] text-[#999]">No saved attendance is available for these filters.</div>}<div className="border-t border-gray-100 px-6 py-4 text-[12px] text-[#777]">Showing {filteredReportPeople.length} of {reportPeople.length} {reportRoleLabel.toLowerCase()}</div></div>
    </>}
    {successModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">✓</div><h2 className="mt-4 font-poppins text-[22px] font-bold text-[#1a1a1a]">Attendance marked</h2><p className="mt-2 text-[14px] leading-6 text-[#666]">Attendance has been finalised for {successModal.saved} {roleLabel.toLowerCase()} for {successModal.attendance_date}.</p>{successModal.parent_notifications > 0 && <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[12px] leading-5 text-blue-700">{successModal.parent_notifications} absence message(s) have been queued for parents.</p>}<p className="mt-3 text-[12px] text-[#999]">This group cannot be submitted again for the same date. Review it in View Attendance.</p><Btn className="mt-5" onClick={() => setSuccessModal(null)}>Done</Btn></div></div>}
  </Layout>;
};

const AttendanceSummary = ({ summary, rate }) => <StatCards items={[{ label: 'Present', value: summary.present, icon: CheckCircle2, tint: 'bg-green-50 text-green-600' }, { label: 'Absent', value: summary.absent, icon: XCircle, tint: 'bg-indigo-50 text-[#4F46E5]' }, { label: 'Late', value: summary.late, icon: Clock, tint: 'bg-amber-50 text-amber-600' }, { label: 'Attendance Rate', value: rate === null ? '—' : `${rate}%`, icon: CalendarCheck, tint: 'bg-blue-50 text-blue-600' }]} />;
const ReportMetric = ({ label, value, suffix, icon: Icon, tint }) => <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tint}`}><Icon size={23} /></div><p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[#777]">{label}</p><div className="mt-2 flex items-end gap-2"><span className="font-poppins text-[34px] font-bold leading-none text-[#1a1a1a]">{value}</span>{suffix && <span className="pb-1 text-[13px] font-semibold text-[#777]">{suffix}</span>}</div></div>;
const AttendanceTable = ({ records, report = false }) => <Card title={report ? 'Attendance report records' : 'Saved attendance'} className="mt-5" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Date' }, { label: 'Role' }, { label: 'Name' }, { label: 'Class / Section' }, { label: 'Status' }, { label: 'Saved by' }]}>{records.map((record) => <tr key={record.id} className="border-b border-gray-50"><td className="px-6 py-3 text-[13px]">{record.attendance_date}</td><td className="py-3 text-[13px] capitalize">{record.attendance_role}</td><td className="py-3 text-[13px] font-medium">{record.entity_name}</td><td className="py-3 text-[13px] text-[#666]">{record.class_name ? `${record.class_name} ${record.section}` : '—'}</td><td className="py-3"><Badge color={record.status === 'Present' ? 'green' : record.status === 'Absent' ? 'red' : 'amber'}>{record.status}</Badge></td><td className="py-3 pr-6 text-[12px] text-[#666]">{record.updated_by || '—'}</td></tr>)}</Table>{!records.length && <div className="py-8 text-center text-[13px] text-[#999]">No saved attendance records match these filters.</div>}</div></Card>;
