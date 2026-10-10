import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Badge, Btn, Card, PageTitle, SearchBar, Table } from '../../components/Shared';
import api from '../../api';
import { downloadCSV } from '../../utils';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, ChevronRight, Clock3, Download,
  FileText, IdCard, LogIn, LogOut, MessageCircle, Phone, Printer, RefreshCw, Search,
  ShieldCheck, UserCheck, Users, X,
} from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = {
  visitor_name: '', phone: '', visitor_type: 'Parent / Guardian', organization: '',
  purpose: '', host_name: '', host_role: '', host_department: '', id_type: 'Aadhaar',
  id_number: '', vehicle_number: '', people_count: '1', notes: '',
};
const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-medium text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50';
const areaClass = `${inputClass} h-24 resize-none py-3 leading-5`;
const Label = ({ children }) => <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{children}</span>;
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const visitDuration = (row) => {
  if (!row.check_in_at) return '—';
  const end = row.check_out_at ? new Date(row.check_out_at) : new Date();
  const minutes = Math.max(0, Math.round((end - new Date(row.check_in_at)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const EmptyState = ({ icon: Icon, title, copy }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="h-6 w-6" /></span>
    <p className="text-[14px] font-bold text-slate-800">{title}</p>
    <p className="mt-1 max-w-md text-[11px] leading-5 text-slate-400">{copy}</p>
  </div>
);

const Notice = ({ notice, close }) => notice && (
  <div className={`mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-[11px] font-semibold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
    {notice.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{notice.text}
    <button onClick={close} className="ml-auto"><X className="h-4 w-4" /></button>
  </div>
);

export const PublicVisitorPass = () => {
  const { token } = useParams();
  const [visitorPass, setVisitorPass] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/public/visitor-pass/${token}`).then(({ data }) => setVisitorPass(data)).catch((requestError) => setError(requestError.response?.data?.detail || 'This visitor pass is unavailable.')); }, [token]);
  if (error) return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><AlertTriangle className="mx-auto h-10 w-10 text-amber-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Pass unavailable</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></div>;
  if (!visitorPass) return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Loading visitor pass…</div>;
  return <div className="min-h-screen bg-slate-100 p-5 md:py-12"><div className="mx-auto max-w-lg overflow-hidden rounded-[30px] bg-white shadow-2xl"><div className="bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-800 p-7 text-white"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">Orison School</p><h1 className="mt-2 text-2xl font-bold">Visitor Pass</h1></div><ShieldCheck className="h-9 w-9 text-emerald-300" /></div><p className="mt-7 font-mono text-2xl font-bold tracking-wider">{visitorPass.pass_number}</p><div className="mt-4"><Badge color="amber">Valid for entry</Badge></div></div><div className="space-y-4 p-7">{[['Visitor', visitorPass.visitor_name], ['Person to meet', visitorPass.host_name], ['Purpose', visitorPass.purpose], ['Visit date', formatDate(visitorPass.check_in_at)], ['Check-in time', formatTime(visitorPass.check_in_at)]].map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-4 last:border-0"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[13px] font-semibold text-slate-800">{value || '—'}</p></div>)}<div className="rounded-xl bg-amber-50 p-4 text-[10px] leading-5 text-amber-800">This secure link expires 6 hours after check-in or immediately after checkout. It does not contain ID details, mobile number, vehicle number, or gate notes.</div></div></div></div>;
};

export default function VisitorManagement({ mode = 'overview' }) {
  const navigate = useNavigate();
  const [visitors, setVisitors] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [hostSelection, setHostSelection] = useState('');
  const [hostCategory, setHostCategory] = useState('Students');
  const [hostSearch, setHostSearch] = useState('');
  const [pass, setPass] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [visitDate, setVisitDate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [visitorRes, studentRes, teacherRes, staffRes] = await Promise.all([
        api.get('/visitors'), api.get('/students'), api.get('/teachers'), api.get('/staff'),
      ]);
      setVisitors(visitorRes.data || []);
      setStudents(studentRes.data || []);
      setTeachers(teacherRes.data || []);
      setStaff(staffRes.data || []);
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.detail || 'Visitor records could not be loaded.' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const todayRows = useMemo(() => visitors.filter((row) => row.visit_date === today()), [visitors]);
  const insideRows = useMemo(() => visitors.filter((row) => row.status === 'Inside'), [visitors]);
  const filtered = useMemo(() => visitors.filter((row) => {
    const text = `${row.visitor_name} ${row.phone} ${row.pass_number} ${row.host_name} ${row.purpose}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (status === 'All' || row.status === status) && (!visitDate || row.visit_date === visitDate);
  }), [visitors, q, status, visitDate]);
  const hosts = useMemo(() => [
    ...students.map((item) => ({ key: `student:${item.id}`, category: 'Students', name: item.name, role: 'Student', department: `${item.class_name || 'Class not set'}${item.section ? ` / ${item.section}` : ''}` })),
    ...teachers.map((item) => ({ key: `teacher:${item.id}`, category: 'Teachers', name: item.name, role: 'Teacher', department: item.subject || 'Academics' })),
    ...staff.map((item) => ({ key: `staff:${item.id}`, category: 'Staff', name: item.name, role: item.designation || item.access_role || 'Staff', department: item.department || 'Administration' })),
  ].sort((a, b) => a.name.localeCompare(b.name)), [students, teachers, staff]);
  const matchingHosts = useMemo(() => hosts.filter((host) => host.category === hostCategory && `${host.name} ${host.department}`.toLowerCase().includes(hostSearch.trim().toLowerCase())), [hosts, hostCategory, hostSearch]);
  const selectHostCategory = (category) => {
    setHostCategory(category);
    setHostSearch('');
    setHostSelection(category === 'Other' ? 'other' : '');
    setForm((current) => ({ ...current, host_name: '', host_role: category === 'Other' ? 'Other' : '', host_department: '' }));
  };

  const chooseHost = (key) => {
    setHostSelection(key);
    if (key === 'other') {
      setForm((current) => ({ ...current, host_name: '', host_role: 'Other', host_department: '' }));
      return;
    }
    const host = hosts.find((item) => item.key === key);
    setForm((current) => ({ ...current, host_name: host?.name || '', host_role: host?.role || '', host_department: host?.department || '' }));
  };
  const register = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/visitors', { ...form, people_count: Number(form.people_count || 1) });
      setPass(response.data);
      setForm(emptyForm);
      setHostSelection('');
      setHostCategory('Students');
      setHostSearch('');
      setNotice({ type: 'success', text: `${response.data.visitor_name} checked in. The host has been notified.` });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.detail || 'Visitor check-in could not be completed.' });
    } finally { setSaving(false); }
  };
  const checkout = async (row) => {
    if (!window.confirm(`Check out ${row.visitor_name} from the campus?`)) return;
    try {
      await api.put(`/visitors/${row.id}/checkout`);
      setNotice({ type: 'success', text: `${row.visitor_name} checked out successfully.` });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.detail || 'Check-out could not be completed.' }); }
  };
  const exportLog = () => downloadCSV('visitor-log.csv', ['Pass', 'Visitor', 'Mobile', 'Type', 'Purpose', 'Host', 'Date', 'Check In', 'Check Out', 'Status'], filtered.map((row) => [row.pass_number, row.visitor_name, row.phone, row.visitor_type, row.purpose, row.host_name, row.visit_date, formatTime(row.check_in_at), formatTime(row.check_out_at), row.status]));
  const visitorPassUrl = pass?.share_token ? `${window.location.origin}/visitor-pass/${pass.share_token}` : '';
  const visitorPassMessage = pass ? `Hello ${pass.visitor_name}, your Orison School visitor pass ${pass.pass_number} is ready and valid for 6 hours or until checkout. Open it here: ${visitorPassUrl}` : '';
  const smsLink = pass ? `sms:${String(pass.phone || '').replace(/[^+\d]/g, '')}?body=${encodeURIComponent(visitorPassMessage)}` : '#';

  const overview = () => (
    <>
      <div className="mb-6 overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-800 p-7 text-white shadow-xl shadow-emerald-100 md:p-9"><div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"><ShieldCheck className="h-3.5 w-3.5" /> Live campus gate</span><h2 className="mt-5 font-poppins text-3xl font-bold md:text-4xl">Know exactly who is inside the school.</h2><p className="mt-3 max-w-xl text-[13px] leading-6 text-emerald-100/70">A clear, accountable view of every visitor, their host, purpose, entry time and safe departure.</p><Btn icon={LogIn} onClick={() => navigate('/visitor/register')} className="mt-5 bg-white text-emerald-950 hover:bg-emerald-50">Check in a visitor</Btn></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[620px]">{[[Users, 'Visitors today', todayRows.length], [LogIn, 'Currently inside', insideRows.length], [LogOut, 'Departed today', todayRows.filter((row) => row.status === 'Checked Out').length], [UserCheck, 'Hosts notified', todayRows.filter((row) => row.host_notified).length]].map(([Icon, label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><Icon className="h-4 w-4 text-emerald-200" /><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-[10px] text-emerald-100/60">{label}</p></div>)}</div></div></div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="People currently inside" subtitle="Live visitor list requiring checkout before departure." className="xl:col-span-2" pad="p-0">
          {insideRows.length === 0 ? <EmptyState icon={ShieldCheck} title="Campus visitor list is clear" copy="No visitor is currently recorded inside the school." /> : <div className="grid grid-cols-1 gap-px bg-slate-100 md:grid-cols-2">{insideRows.map((row) => <div key={row.id} className="bg-white p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 font-bold text-amber-700">{row.visitor_name?.charAt(0) || 'V'}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[13px] font-bold text-slate-900">{row.visitor_name}</p><Badge color="amber">Inside · {visitDuration(row)}</Badge></div><p className="mt-1 text-[9px] text-slate-400">{row.pass_number} · {row.visitor_type} · {row.people_count || 1} person(s)</p></div></div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Meeting {row.host_name}</p><p className="mt-1 line-clamp-2 text-[10px] font-medium text-slate-600">{row.purpose}</p><p className="mt-2 text-[9px] text-slate-400">Entered at {formatTime(row.check_in_at)}{row.vehicle_number ? ` · Vehicle ${row.vehicle_number}` : ''}</p></div><Btn variant="outline" icon={LogOut} onClick={() => checkout(row)} className="mt-4 w-full">Record checkout</Btn></div>)}</div>}
        </Card>
        <div className="space-y-5">
          <Card title="Gate attention" subtitle="Items requiring action now"><div className="space-y-3"><div className={`rounded-2xl p-4 ${insideRows.length ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}><div className="flex items-center gap-3">{insideRows.length ? <Clock3 className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}<div><p className="text-[12px] font-bold">{insideRows.length ? `${insideRows.length} checkout${insideRows.length === 1 ? '' : 's'} pending` : 'No pending checkout'}</p><p className="mt-1 text-[9px] opacity-70">{insideRows.length ? 'Confirm departure when each visitor leaves.' : 'The live gate register is clear.'}</p></div></div></div><button onClick={() => navigate('/visitor/log')} className="flex w-full items-center rounded-xl border border-slate-100 p-4 text-left hover:bg-slate-50"><FileText className="h-4 w-4 text-indigo-500" /><span className="ml-3 text-[10px] font-semibold text-slate-700">Open complete visitor log</span><ChevronRight className="ml-auto h-4 w-4 text-slate-300" /></button></div></Card>
          <Card title="Today’s gate movement" subtitle="Latest entries and departures"><div className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-slate-100">{todayRows.slice(0, 5).map((row) => <div key={row.id} className="relative flex items-start gap-3"><span className={`relative z-10 mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${row.status === 'Inside' ? 'bg-amber-400' : 'bg-emerald-400'}`} /><div className="flex-1"><p className="text-[10px] font-semibold text-slate-700">{row.visitor_name}</p><p className="mt-0.5 text-[9px] text-slate-400">{row.status === 'Inside' ? `Entered ${formatTime(row.check_in_at)}` : `Left ${formatTime(row.check_out_at)}`} · {row.host_name}</p></div></div>)}{!todayRows.length && <p className="py-5 text-center text-[10px] text-slate-400">No movement recorded today.</p>}</div></Card>
        </div>
      </div>
    </>
  );

  const registration = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <form onSubmit={register} className="space-y-5 xl:col-span-2">
        <Card title="Visitor identity" subtitle="Record only the information required for campus security.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label><Label>Visitor name *</Label><input required className={inputClass} value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} placeholder="Full name as shown on ID" /></label><label><Label>Mobile number *</Label><input required className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile number" /></label><label><Label>Visitor type</Label><select className={inputClass} value={form.visitor_type} onChange={(e) => setForm({ ...form, visitor_type: e.target.value })}>{['Parent / Guardian', 'Vendor', 'Government Official', 'Alumni', 'Job Applicant', 'Guest', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label><label><Label>Organisation (optional)</Label><input className={inputClass} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="Company or department" /></label><label><Label>ID type</Label><select className={inputClass} value={form.id_type} onChange={(e) => setForm({ ...form, id_type: e.target.value })}>{['Aadhaar', 'Driving Licence', 'Voter ID', 'Passport', 'Employee ID', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label><label><Label>ID number</Label><input className={inputClass} value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} placeholder="Last four digits are enough when policy allows" /></label></div>
        </Card>
        <Card title="Visit and host" subtitle="The selected host is notified automatically after check-in.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label className="md:col-span-2"><Label>Purpose of visit *</Label><textarea required className={areaClass} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Parent meeting regarding Class 1 progress" /></label><div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5"><Label>Person wants to meet *</Label><p className="mb-3 text-[10px] text-slate-500">First choose the person type, then search and select the person.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{['Students', 'Teachers', 'Staff', 'Other'].map((category) => <button type="button" key={category} onClick={() => selectHostCategory(category)} className={`rounded-xl border px-3 py-3 text-[11px] font-semibold transition ${hostCategory === category ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}>{category}</button>)}</div>{hostCategory !== 'Other' ? <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><label><Label>Search {hostCategory}</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-9`} value={hostSearch} onChange={(e) => { setHostSearch(e.target.value); setHostSelection(''); setForm((current) => ({ ...current, host_name: '', host_role: '', host_department: '' })); }} placeholder={`Search by ${hostCategory === 'Students' ? 'student name or class' : 'name or department'}`} /></div></label><label><Label>Select {hostCategory.slice(0, -1)}</Label><select required className={inputClass} value={hostSelection} onChange={(e) => chooseHost(e.target.value)}><option value="">{matchingHosts.length ? `Choose from ${matchingHosts.length} result${matchingHosts.length === 1 ? '' : 's'}` : 'No matching person found'}</option>{matchingHosts.map((host) => <option key={host.key} value={host.key}>{host.name} · {host.department}</option>)}</select></label></div> : <label className="mt-4 block"><Label>Enter person or office name</Label><input required className={inputClass} value={form.host_name} onChange={(e) => setForm({ ...form, host_name: e.target.value, host_role: 'Other' })} placeholder="e.g. Principal Office or external coordinator" /></label>}{form.host_name && <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3"><UserCheck className="h-4 w-4 text-emerald-600" /><div><p className="text-[10px] font-bold text-slate-800">{form.host_name}</p><p className="text-[9px] text-slate-400">{form.host_role}{form.host_department ? ` · ${form.host_department}` : ''}</p></div><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" /></div>}</div><label><Label>Vehicle number</Label><input className={inputClass} value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="Optional" /></label><label><Label>Number of visitors</Label><input type="number" min="1" max="20" className={inputClass} value={form.people_count} onChange={(e) => setForm({ ...form, people_count: e.target.value })} /></label><label className="md:col-span-2"><Label>Gate notes (optional)</Label><textarea className={areaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any item carried, access instruction or assistance required" /></label></div>
          <div className="mt-5 flex justify-end"><Btn type="submit" icon={LogIn} disabled={saving}>{saving ? 'Checking in…' : 'Check in & issue pass'}</Btn></div>
        </Card>
      </form>
      <div className="space-y-5">
        {pass ? <Card title="Visitor pass issued" subtitle="Print it or send its secure six-hour link directly to the visitor."><div className="rounded-2xl bg-slate-900 p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/45">Orison School · Visitor Pass</p><p className="mt-3 text-[20px] font-bold">{pass.pass_number}</p></div><ShieldCheck className="h-7 w-7 text-emerald-300" /></div><div className="mt-6 space-y-3 border-t border-white/10 pt-4"><div><p className="text-[9px] text-white/40">Visitor</p><p className="text-[12px] font-semibold">{pass.visitor_name}</p></div><div><p className="text-[9px] text-white/40">Meeting</p><p className="text-[12px] font-semibold">{pass.host_name}</p></div><div className="flex justify-between"><div><p className="text-[9px] text-white/40">Checked in</p><p className="text-[11px] font-semibold">{formatTime(pass.check_in_at)}</p></div><Badge color="green">Inside</Badge></div></div></div><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><Btn variant="outline" icon={Printer} onClick={() => window.print()} className="w-full">Print visitor pass</Btn><a href={smsLink} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"><MessageCircle className="h-4 w-4" />Send pass link</a></div><p className="mt-3 text-center text-[9px] text-slate-400">Opens a message to {pass.phone}. The link expires after 6 hours or checkout.</p></Card> : <Card title="Pass preview" subtitle="The digital pass appears after successful check-in"><EmptyState icon={IdCard} title="Ready for visitor details" copy="Complete identity, purpose and host information to generate a traceable visitor pass." /></Card>}
        <Card title="Privacy and safety" subtitle="Gate staff guidance"><div className="space-y-3">{['Verify the visitor’s identity before entry.', 'Do not store unnecessary identity information.', 'Host selection is compulsory for every visit.', 'Check out the visitor immediately on departure.'].map((item) => <div key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p className="text-[10px] leading-5 text-slate-600">{item}</p></div>)}</div></Card>
      </div>
    </div>
  );

  const log = () => (
    <>
      <Card title="Find visitor records" subtitle="Search by visitor, mobile, pass number, host or purpose.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4"><SearchBar value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visitor records" className="md:col-span-2" /><select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Inside</option><option>Checked Out</option></select><input type="date" className={inputClass} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} /></div>
      </Card>
      <Card title="Visitor log" subtitle={`${filtered.length} record(s) match the selected filters.`} action={<Btn variant="outline" icon={Download} onClick={exportLog}>Export CSV</Btn>} pad="p-0" className="mt-5">
        {filtered.length === 0 ? <EmptyState icon={Search} title="No visitor records found" copy="Adjust the search, status or date filter." /> : <div className="overflow-x-auto"><Table columns={[{ label: 'Pass / Visitor' }, { label: 'Purpose / Host' }, { label: 'Date' }, { label: 'Movement' }, { label: 'Duration' }, { label: 'Status' }, { label: 'Action' }]}>{filtered.map((row) => <tr key={row.id} className="border-b border-slate-50 last:border-0"><td className="px-6 py-4"><p className="text-[12px] font-bold text-slate-800">{row.visitor_name}</p><p className="mt-1 text-[9px] text-slate-400">{row.pass_number} · {row.phone}</p></td><td className="py-4"><p className="text-[11px] font-semibold text-slate-700">{row.purpose}</p><p className="mt-1 text-[9px] text-slate-400">Meeting {row.host_name}</p></td><td className="py-4 text-[10px] text-slate-500">{formatDate(row.check_in_at)}</td><td className="py-4 text-[10px] text-slate-500">In {formatTime(row.check_in_at)}<br />Out {formatTime(row.check_out_at)}</td><td className="py-4 text-[10px] font-semibold text-slate-600">{visitDuration(row)}</td><td className="py-4"><Badge color={row.status === 'Inside' ? 'amber' : 'green'}>{row.status}</Badge></td><td className="py-4 pr-6">{row.status === 'Inside' ? <Btn variant="outline" icon={LogOut} onClick={() => checkout(row)}>Check out</Btn> : <span className="text-[10px] text-slate-400">Complete</span>}</td></tr>)}</Table></div>}
      </Card>
    </>
  );

  const meta = mode === 'register' ? ['Register Visitor', 'Verify the visitor, notify the host and issue a traceable gate pass.'] : mode === 'log' ? ['Visitor Log', 'Review campus entry and exit history with clear accountability.'] : ['Visitor Overview', 'A live, reliable view of everyone entering and leaving the campus.'];
  return (
    <Layout>
      <PageTitle title={meta[0]} subtitle={meta[1]} actions={<Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh</Btn>} />
      <div className="mb-6 inline-flex rounded-xl border border-slate-100 bg-white p-1 shadow-sm">{[['overview', '/visitor', 'Gate overview'], ['register', '/visitor/register', 'Check in visitor'], ['log', '/visitor/log', 'Visitor log']].map(([key, path, label]) => <button key={key} onClick={() => navigate(path)} className={`rounded-lg px-4 py-2.5 text-[10px] font-semibold transition ${mode === key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{label}</button>)}</div>
      <Notice notice={notice} close={() => setNotice(null)} />
      {loading ? <Card><EmptyState icon={RefreshCw} title="Loading visitor records" copy="Connecting to the school gate register…" /></Card> : mode === 'register' ? registration() : mode === 'log' ? log() : overview()}
    </Layout>
  );
}
