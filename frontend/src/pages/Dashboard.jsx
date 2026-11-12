import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Users, Wallet, CalendarCheck, GraduationCap, ArrowUpRight, TrendingUp, AlertTriangle, Receipt, Award, Percent, RefreshCw, Sparkles, Bell, BookOpenCheck, Building2, ChevronLeft, ChevronRight, CheckCircle2, School, UserCheck, CalendarDays, Clock3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { SetupChecklistCard } from '../components/SetupChecklist';
import { Boxes, BookOpen, ClipboardCheck, FileSignature, NotebookPen, PackagePlus, ScrollText, ArrowRight, BadgeIndianRupee } from 'lucide-react';

const fmtL = (n) => `₹${(n / 100000).toFixed(1)}L`;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const PIE = ['#4F46E5', '#f59e0b', '#3b82f6'];

const useAnalytics = (url) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setLoading(true); setError(false);
    api.get(url)
      .then(({ data }) => { setData(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
};

const StatSkeleton = () => (
  <div className="bg-white/90 rounded-2xl border border-white ring-1 ring-slate-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] p-5 animate-pulse">
    <div className="w-11 h-11 rounded-xl bg-gray-100" />
    <div className="h-7 w-24 bg-gray-100 rounded mt-4" />
    <div className="h-3 w-20 bg-gray-100 rounded mt-2.5" />
  </div>
);

const StatGrid = ({ items, loading }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
    {loading
      ? [0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)
      : items.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`} className="group relative overflow-hidden bg-white/90 rounded-2xl border border-white ring-1 ring-slate-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(15,23,42,0.09)]">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-50 to-transparent" />
              <div className="flex items-center justify-between">
                <span className={`relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${s.tint}`}><Icon className="w-5 h-5" /></span>
                {s.delta && <span className="flex items-center gap-1 text-[13px] font-semibold text-green-600"><TrendingUp className="w-3.5 h-3.5" /> {s.delta}</span>}
              </div>
              <p className="text-[26px] font-poppins font-bold tracking-[-0.04em] text-slate-900 mt-4">{s.value}</p>
              <p className="text-[13px] font-medium text-slate-500">{s.label}</p>
            </div>
          );
        })}
  </div>
);

const ErrorState = ({ onRetry }) => (
  <div data-testid="dashboard-error" className="bg-white/90 rounded-2xl border border-indigo-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] p-12 text-center">
    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-[#4F46E5]" /></div>
    <p className="text-[15px] font-semibold text-[#1a1a1a]">Couldn't load dashboard data</p>
    <p className="text-[14px] text-[#8a8a8a] mt-1">Please check your connection and try again.</p>
    <button onClick={onRetry} data-testid="dashboard-retry-btn" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_9px_18px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5">
      <RefreshCw className="w-4 h-4" /> Retry
    </button>
  </div>
);

const ChartCard = ({ title, loading, empty, emptyText, children }) => (
  <div className="relative overflow-hidden bg-white/90 rounded-2xl border border-white ring-1 ring-slate-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] p-6 transition-all hover:shadow-[0_18px_38px_rgba(15,23,42,0.075)]">
    <div className="mb-4 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#635BFF]" /><h3 className="font-poppins text-[16px] font-bold tracking-[-0.02em] text-slate-900">{title}</h3></div>
    {loading ? (
      <div className="h-[220px] rounded-xl bg-gray-50 animate-pulse" />
    ) : empty ? (
      <div className="h-[220px] flex items-center justify-center text-[14px] text-[#999]">{emptyText || 'No data yet.'}</div>
    ) : children}
  </div>
);

const LiveCalendar = () => {
  const [now, setNow] = useState(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [visibleMonth]);

  const isCurrentMonth = visibleMonth.getFullYear() === now.getFullYear() && visibleMonth.getMonth() === now.getMonth();
  const moveMonth = (amount) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const resetToday = () => setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));

  return (
    <section className="w-full rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.055)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CalendarDays className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-[13px] font-bold text-slate-800">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p><p className="mt-0.5 text-[12px] font-semibold uppercase tracking-wider text-slate-400">Live calendar · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p></div></div>
        <button type="button" onClick={resetToday} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[12px] font-bold text-indigo-600">Today</button>
      </div>
      <div className="mt-3 flex items-center justify-between"><h2 className="font-poppins text-[14px] font-bold text-slate-900">{visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><div className="flex gap-1"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><ChevronLeft className="h-3.5 w-3.5" /></button><button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><ChevronRight className="h-3.5 w-3.5" /></button></div></div>
      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <div key={`${day}-${index}`} className="py-1 text-[12px] font-bold text-slate-400">{day}</div>)}{days.map((day, index) => { const isToday = isCurrentMonth && day === now.getDate(); return <div key={`${day || 'empty'}-${index}`} className={`flex h-6 items-center justify-center rounded-md text-[12px] font-semibold ${!day ? '' : isToday ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-50'}`}>{day || ''}</div>; })}</div>
    </section>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAnalytics('/analytics/dashboard');
  const priorityLevel = {
    critical: { label: 'Critical', badge: 'border-rose-200 bg-rose-500 text-white', pill: 'bg-rose-50 text-rose-700' },
    high: { label: 'High', badge: 'border-orange-200 bg-orange-500 text-white', pill: 'bg-orange-50 text-orange-700' },
    medium: { label: 'Medium', badge: 'border-amber-200 bg-amber-500 text-white', pill: 'bg-amber-50 text-amber-700' },
    low: { label: 'Low', badge: 'border-blue-200 bg-blue-500 text-white', pill: 'bg-blue-50 text-blue-700' },
    clear: { label: 'Clear', badge: 'border-emerald-200 bg-emerald-500 text-white', pill: 'bg-emerald-50 text-emerald-700' },
  };
  const priorityDepartment = (item) => {
    const path = item.path || '';
    if (path.startsWith('/attendance')) return { label: 'Attendance', icon: CalendarCheck, tone: 'bg-blue-50 text-blue-600 ring-blue-100' };
    if (path.startsWith('/collections') || path.startsWith('/fee')) return { label: 'Finance', icon: Wallet, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' };
    if (path.startsWith('/notifications')) return { label: 'Leadership', icon: Bell, tone: 'bg-violet-50 text-violet-600 ring-violet-100' };
    if (path.startsWith('/academics')) return { label: 'Academics', icon: BookOpenCheck, tone: 'bg-amber-50 text-amber-600 ring-amber-100' };
    if (path.startsWith('/leave')) return { label: 'HR & Leave', icon: CalendarDays, tone: 'bg-cyan-50 text-cyan-600 ring-cyan-100' };
    return { label: 'School Operations', icon: School, tone: 'bg-indigo-50 text-indigo-600 ring-indigo-100' };
  };
  const hasAttendanceTrend = data?.attendance_trend?.some((item) => item.rate != null);
  const collection = data?.stats || {};
  const collectionProgress = Math.max(0, Math.min(100, Number(collection.collection_efficiency || 0)));
  // Priority actions are unresolved work. This feed deliberately excludes
  // warning events so it remains a factual record of what already happened.
  const recentSchoolActivity = (data?.recent_activity || []).filter((event) => event.type !== 'warning').slice(0, 6);
  const activityTime = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const formattedDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(118deg,#111827_0%,#272B67_54%,#5B4FE9_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(49,46,129,0.22)] sm:px-8">
        <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full border border-white/10 bg-white/5" />
        <div className="absolute -bottom-28 right-52 h-56 w-56 rounded-full bg-violet-400/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-indigo-100">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live school pulse</span>
              <span>{data?.academic_year || 'Academic year not configured'}</span>
            </div>
            <div className="mt-4 flex items-center gap-3"><Sparkles className="h-6 w-6 text-violet-300" /><h1 className="font-poppins text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">School Command Center</h1></div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur"><p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-indigo-200">Today</p><p className="mt-1 text-[13px] font-semibold">{formattedDate}</p></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-stretch">
        <div className="xl:col-span-8">
          {loading ? <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)}</div> : (
            <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'Enrolled students', value: Number(collection.students || 0).toLocaleString('en-IN'), note: `${collection.classes || 0} classes · ${collection.sections || 0} sections`, icon: Users, tone: 'from-indigo-500 to-violet-500', path: '/students/view' },
                { label: 'Attendance today', value: collection.attendance == null ? 'Not marked' : `${collection.attendance}%`, note: collection.attendance_marked ? `${collection.present_today} present · ${collection.absent_today} absent` : `${collection.attendance_unmarked || 0} students awaiting status`, icon: UserCheck, tone: 'from-cyan-500 to-blue-500', path: '/attendance/view' },
                { label: 'Collection efficiency', value: `${collection.collection_efficiency || 0}%`, note: `${fmt(collection.fees_collected)} collected`, icon: Wallet, tone: 'from-emerald-500 to-teal-500', path: '/fee/collections' },
                { label: 'Teaching team', value: Number(collection.teachers || 0).toLocaleString('en-IN'), note: `${collection.staff || 0} non-teaching staff`, icon: GraduationCap, tone: 'from-amber-500 to-orange-500', path: '/teachers/view' },
              ].map((item) => <button key={item.label} onClick={() => navigate(item.path)} className="group relative overflow-hidden rounded-[22px] border border-white bg-gradient-to-br from-white to-slate-50/80 p-4 text-left ring-1 ring-slate-100 shadow-[0_12px_35px_rgba(15,23,42,0.055)] transition hover:-translate-y-1 hover:ring-indigo-200 hover:shadow-[0_18px_45px_rgba(79,70,229,0.11)]"><span className="absolute -right-7 -top-7 h-20 w-20 rounded-full bg-indigo-50/70"/><div className="relative flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-white shadow-lg`}><item.icon className="h-4 w-4" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" /></div><div className="relative mt-3 flex items-end justify-between gap-3"><div><p className="font-poppins text-[23px] font-bold tracking-[-0.04em] text-slate-950">{item.value}</p><p className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</p></div><p className="max-w-[145px] text-right text-[12px] leading-4 text-slate-500">{item.note}</p></div></button>)}
            </div>
          )}
        </div>
        <div className="flex xl:col-span-4"><LiveCalendar /></div>
      </section>

      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)] xl:col-span-7">
          <div className="flex items-start justify-between"><div><p className="text-[12px] font-bold uppercase tracking-[0.15em] text-indigo-500">Management queue</p><h2 className="mt-1 font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Today’s priority actions</h2><p className="mt-1 text-[12px] text-slate-400">Highest-impact issues, automatically ranked from live records.</p></div><button onClick={reload} className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:text-indigo-600"><RefreshCw className="h-4 w-4" /></button></div>
          <div className="mt-5 divide-y divide-slate-100">
            {(data?.priorities || []).map((item, index) => {
              const department = priorityDepartment(item);
              const DepartmentIcon = department.icon;
              const level = priorityLevel[item.level] || priorityLevel.low;
              return <button key={`${item.title}-${index}`} onClick={() => navigate(item.path)} className="group flex w-full items-center gap-4 py-4 text-left">
                <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${department.tone}`}><DepartmentIcon className="h-5 w-5" /><span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${level.badge}`}>{item.level === 'clear' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}</span></span>
                <span className="min-w-0 flex-1"><span className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[12px] font-bold uppercase tracking-[0.13em] text-slate-400">{department.label}</span><span className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide ${level.pill}`}>{level.label}</span></span><span className="block text-[13px] font-bold text-slate-800">{item.title}</span><span className="mt-1 block truncate text-[12px] text-slate-400">{item.detail}</span></span>
                {item.value > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-600">{item.value}</span>}<ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500" />
              </button>;
            })}
          </div>
        </div>

        <div className="xl:col-span-5">
          <div className="rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-emerald-600">Finance health</p><div className="mt-1 flex items-end justify-between"><div><h2 className="font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Fee collection</h2><p className="mt-1 text-[12px] text-slate-400">Expected versus realised for the current data set.</p></div><span className="text-[22px] font-bold text-emerald-600">{collectionProgress}%</span></div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[linear-gradient(90deg,#10B981,#14B8A6)] transition-all" style={{ width: `${collectionProgress}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-3"><p className="text-[12px] font-bold uppercase tracking-wider text-emerald-600">Collected</p><p className="mt-1.5 text-[14px] font-bold text-slate-900">{fmt(collection.fees_collected)}</p></div><div className="rounded-xl bg-rose-50 p-3"><p className="text-[12px] font-bold uppercase tracking-wider text-rose-500">Outstanding</p><p className="mt-1.5 text-[14px] font-bold text-slate-900">{fmt(collection.fees_outstanding)}</p></div></div>
            <button onClick={() => navigate('/collections')} className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-950 px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-indigo-700"><span>Open collection intelligence</span><ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)] xl:col-span-7">
          <div className="flex items-start justify-between"><div><p className="text-[12px] font-bold uppercase tracking-[0.15em] text-blue-600">7-day view</p><h2 className="mt-1 font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Attendance movement</h2></div><button onClick={() => navigate('/attendance/reports')} className="text-[12px] font-bold text-indigo-600">View report →</button></div>
          {hasAttendanceTrend ? <div className="mt-5"><ResponsiveContainer width="100%" height={210}><AreaChart data={data?.attendance_trend || []} margin={{ left: -24, right: 8, top: 8 }}><defs><linearGradient id="adminAtt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.30} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value}%`, 'Attendance']} contentStyle={{ borderRadius: 14, border: '1px solid #E2E8F0', fontSize: 12 }} /><Area connectNulls type="monotone" dataKey="rate" stroke="#4F46E5" strokeWidth={3} fill="url(#adminAtt)" /></AreaChart></ResponsiveContainer></div> : <div className="mt-5 flex h-[210px] flex-col items-center justify-center rounded-2xl bg-slate-50"><CalendarCheck className="h-7 w-7 text-slate-300" /><p className="mt-3 text-[13px] font-semibold text-slate-500">No attendance history yet</p><button onClick={() => navigate('/attendance/add')} className="mt-2 text-[12px] font-bold text-indigo-600">Mark today’s attendance</button></div>}
        </div>

        <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)] xl:col-span-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-violet-600">Learning operations</p><h2 className="mt-1 font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Academic pulse</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">{[
            { label: 'Upcoming exams', value: data?.academic_pulse?.upcoming_exams || 0, icon: CalendarDays, path: '/exams/view', tone: 'bg-indigo-50 text-indigo-600' },
            { label: 'Syllabus behind', value: data?.academic_pulse?.syllabus_behind || 0, icon: Clock3, path: '/academics/syllabus', tone: 'bg-amber-50 text-amber-600' },
            { label: 'Open interventions', value: data?.academic_pulse?.open_interventions || 0, icon: BookOpenCheck, path: '/academics/interventions', tone: 'bg-rose-50 text-rose-600' },
            { label: 'Teacher allocation', value: `${data?.academic_pulse?.teacher_allocation_coverage || 0}%`, icon: School, path: '/teachers/allocations', tone: 'bg-emerald-50 text-emerald-600' },
          ].map((item) => <button key={item.label} onClick={() => navigate(item.path)} className="rounded-2xl border border-slate-100 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/30"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}><item.icon className="h-4 w-4" /></span><p className="mt-3 text-[18px] font-bold text-slate-900">{item.value}</p><p className="mt-1 text-[12px] font-semibold text-slate-400">{item.label}</p></button>)}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.055)]">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 px-6 py-5 text-white sm:flex-row sm:items-center">
          <div><p className="text-[12px] font-bold uppercase tracking-[0.16em] text-emerald-300">Completed and recorded</p><h2 className="mt-1 font-poppins text-[18px] font-bold">Recent school activity</h2><p className="mt-1 text-[12px] text-indigo-100/65">A read-only timeline of actions already completed or updates already recorded across the school.</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><span className="text-[12px] font-bold">History only · no pending tasks</span></div>
        </div>
        {recentSchoolActivity.length ? <div className="grid grid-cols-1 gap-x-6 p-5 md:grid-cols-2">{recentSchoolActivity.map((event, index) => {
          const completed = event.type === 'success';
          return <article key={`${event.id || event.title}-${index}`} className="relative flex gap-3 border-b border-slate-100 py-4 last:border-0 md:[&:nth-last-child(-n+2)]:border-0">
            <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${completed ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-blue-50 text-blue-600 ring-blue-100'}`}>{completed ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[12px] font-bold uppercase tracking-wide ${completed ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{completed ? 'Completed' : 'Recorded'}</span><time className="text-[12px] font-semibold text-slate-400">{activityTime(event.created)}</time></div><h3 className="mt-2 text-[13px] font-bold text-slate-800">{event.title}</h3><p className="mt-1 line-clamp-2 text-[12px] leading-4 text-slate-500">{event.body}</p></div>
          </article>;
        })}</div> : <div className="py-14 text-center"><Clock3 className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-[13px] font-semibold text-slate-500">No completed school activity has been recorded yet.</p><p className="mt-1 text-[12px] text-slate-400">Completed admissions, payments, attendance and academic updates will appear here.</p></div>}
      </section>

    </div>
  );
};

const DirectorDashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAnalytics('/analytics/dashboard');
  if (error) return <ErrorState onRetry={reload} />;
  const stats = data?.stats || {};
  const operations = data?.operations || {};
  const pulse = data?.academic_pulse || {};
  const oversight = [
    { label: 'Admission performance', copy: 'Conversion and admission reporting', path: '/admissions/reports', icon: UserCheck, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Academic health', copy: 'Student risk and support visibility', path: '/academics/action-center', icon: BookOpenCheck, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Collection intelligence', copy: 'Outstanding dues and recovery progress', path: '/collections', icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Attendance reports', copy: 'Daily and monthly attendance position', path: '/attendance/reports', icon: CalendarCheck, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Published results', copy: 'Validated results and report cards', path: '/marks/results', icon: Award, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Branch performance', copy: 'Compare campuses and consolidated results', path: '/multi-branch/overview', icon: Building2, tone: 'bg-cyan-50 text-cyan-700' },
  ];
  const attention = [
    { label: 'Management approvals pending', value: operations.pending_approvals || 0, path: '/notifications', tone: 'text-violet-700 bg-violet-50' },
    { label: 'Attendance records still incomplete', value: stats.attendance_unmarked || 0, path: '/attendance/reports', tone: 'text-blue-700 bg-blue-50' },
    { label: 'Overdue fee accounts', value: operations.overdue_fee_accounts || 0, path: '/collections', tone: 'text-rose-700 bg-rose-50' },
    { label: 'Students needing academic attention', value: pulse.open_interventions || 0, path: '/academics/student-health', tone: 'text-amber-700 bg-amber-50' },
    { label: 'Leave decisions pending', value: operations.pending_leaves || 0, path: '/leave/requests', tone: 'text-cyan-700 bg-cyan-50' },
  ];
  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(118deg,#0F172A_0%,#312E81_56%,#5B4FE9_100%)] p-7 text-white shadow-[0_24px_60px_rgba(49,46,129,0.22)] sm:p-8">
        <span className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/5" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-[12px] font-bold uppercase tracking-[0.17em] text-indigo-200">Director workspace</p><h1 className="mt-3 font-poppins text-[30px] font-bold tracking-[-0.045em]">Leadership visibility without operational clutter.</h1><p className="mt-2 max-w-2xl text-[13px] leading-6 text-indigo-100/70">Review school performance, exceptions and approvals. Routine data entry remains with the responsible school teams.</p></div><button onClick={reload} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[12px] font-bold backdrop-blur"><RefreshCw className="h-4 w-4" /> Refresh overview</button></div>
      </section>
      <StatGrid loading={loading} items={[
        { label: 'Enrolled Students', value: Number(stats.students || 0).toLocaleString('en-IN'), icon: Users, tint: 'bg-indigo-50 text-indigo-600' },
        { label: 'Attendance Today', value: stats.attendance == null ? 'Pending' : `${stats.attendance}%`, icon: CalendarCheck, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Collection Efficiency', value: `${stats.collection_efficiency || 0}%`, icon: Wallet, tint: 'bg-emerald-50 text-emerald-600' },
        { label: 'Pending Approvals', value: operations.pending_approvals || 0, icon: Bell, tint: 'bg-violet-50 text-violet-600' },
      ]} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)]"><p className="text-[12px] font-bold uppercase tracking-[0.15em] text-indigo-500">Leadership views</p><h2 className="mt-1 font-poppins text-[19px] font-bold text-slate-950">School performance and governance</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{oversight.map((item) => <button key={item.path} onClick={() => navigate(item.path)} className="group flex items-center gap-3 rounded-2xl border border-slate-100 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}><item.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><b className="block text-[13px] text-slate-800">{item.label}</b><small className="mt-1 block text-[12px] leading-4 text-slate-400">{item.copy}</small></span><ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" /></button>)}</div></section>
        <section className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)]"><p className="text-[12px] font-bold uppercase tracking-[0.15em] text-rose-500">Needs review</p><h2 className="mt-1 font-poppins text-[19px] font-bold text-slate-950">Exceptions and decisions</h2><div className="mt-5 divide-y divide-slate-100">{attention.map((item) => <button key={item.label} onClick={() => navigate(item.path)} className="flex w-full items-center gap-3 py-3.5 text-left"><span className={`flex h-9 min-w-9 items-center justify-center rounded-xl text-[13px] font-bold ${item.tone}`}>{item.value}</span><span className="flex-1 text-[12px] font-semibold text-slate-600">{item.label}</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}</div></section>
      </div>
    </div>
  );
};

const FeeDashboard = () => {
  const { data, loading, error, reload } = useAnalytics('/analytics/fee');
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <>
      <StatGrid loading={loading} items={data ? [
        { label: 'Total Collected', value: fmtL(data.stats.collected), delta: '+8.1%', icon: Wallet, tint: 'bg-green-50 text-green-600' },
        { label: 'Pending Dues', value: fmt(data.stats.pending), icon: AlertTriangle, tint: 'bg-indigo-50 text-[#4F46E5]' },
        { label: 'Total Billed', value: fmtL(data.stats.total), icon: TrendingUp, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Invoices', value: data.stats.invoices, icon: Receipt, tint: 'bg-amber-50 text-amber-600' },
      ] : []} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <ChartCard title="Monthly Collections" loading={loading} empty={!!data && !data.monthly?.length}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data?.monthly || []} margin={{ left: -10, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v / 100000}L`} tick={{ fontSize: 12, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtL(v)} contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="amount" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Payment Method Split" loading={loading} empty={!!data && !data.method_split?.length}>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={data?.method_split || []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                {(data?.method_split || []).map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-1">
            {(data?.method_split || []).map((e, i) => <span key={i} className="flex items-center gap-1.5 text-[13px] text-[#888]"><span className="w-2 h-2 rounded-full" style={{ background: PIE[i % PIE.length] }} /> {e.name}</span>)}
          </div>
        </ChartCard>
        <ChartCard title="Top Outstanding Dues" loading={loading} empty={!!data && !data.top_dues?.length} emptyText="No pending dues 🎉">
          <div className="space-y-3">
            {(data?.top_dues || []).map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3"><img src={d.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /><span className="text-[14px] font-medium text-[#333]">{d.name}</span></div>
                <span className="text-[14px] font-bold text-[#4F46E5]">{fmt(d.due)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </>
  );
};

const AcademicCoordinatorDashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAnalytics('/analytics/academic');
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col justify-between gap-5 rounded-[24px] bg-gradient-to-r from-[#172554] via-[#312E81] to-[#5B4FE9] p-7 text-white shadow-[0_20px_50px_rgba(49,46,129,0.20)] md:flex-row md:items-center">
        <div><p className="text-[12px] font-bold uppercase tracking-[0.16em] text-indigo-200">Academic Coordinator Workspace</p><h1 className="mt-2 font-poppins text-[28px] font-bold tracking-[-0.04em]">Academic performance at a glance</h1><p className="mt-2 max-w-2xl text-[13px] leading-6 text-indigo-100/75">Monitor learning outcomes, syllabus progress and students requiring academic support.</p></div>
        <button onClick={() => navigate('/academics/action-center')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[13px] font-bold text-indigo-900 shadow-lg"><BookOpenCheck className="h-4 w-4" /> Open Academic Action Center</button>
      </section>
      <StatGrid loading={loading} items={data ? [
        { label: 'Pass Rate', value: `${data.stats.pass_rate}%`, delta: '+1.2%', icon: Award, tint: 'bg-green-50 text-green-600' },
        { label: 'Class Average', value: `${data.stats.avg}%`, icon: Percent, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Subjects Assessed', value: data.subject_scores?.length || 0, icon: BookOpenCheck, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Students', value: data.stats.students, icon: Users, tint: 'bg-indigo-50 text-[#5B5FEF]' },
      ] : []} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <ChartCard title="Subject-wise Scores" loading={loading} empty={!!data && !data.subject_scores?.length}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data?.subject_scores || []} margin={{ left: -10, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="score" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Academic Workbench" loading={loading} empty={false}>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">{[
            { label: 'Curriculum & Syllabus', path: '/academics/syllabus', icon: BookOpenCheck },
            { label: 'Student Health Signals', path: '/academics/student-health', icon: UserCheck },
            { label: 'Student Support Plans', path: '/academics/support-plans', icon: UserCheck },
            { label: 'Classroom Observations', path: '/academics/classroom-observations', icon: School },
            { label: 'Academic Notifications', path: '/notifications/send', icon: Bell },
          ].map((item) => <button key={item.path} onClick={() => navigate(item.path)} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><item.icon className="h-4 w-4" /></span><span className="text-[13px] font-bold text-slate-700">{item.label}</span><ChevronRight className="ml-auto h-4 w-4 text-slate-300" /></button>)}</div>
        </ChartCard>
      </div>
      <div className="bg-white/90 rounded-2xl border border-white ring-1 ring-slate-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] p-6 mt-6">
        <div className="mb-4 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#635BFF]" /><h3 className="font-poppins text-[16px] font-bold tracking-[-0.02em] text-slate-900">Top Performers</h3></div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-50 animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {(data?.results_top || []).map((r, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-[#fafafa] p-4 text-center">
                <p className="text-[13px] text-[#a0a0a0]">Rank #{r.rank}</p>
                <p className="text-[14px] font-semibold text-[#1a1a1a] mt-1 truncate">{r.name}</p>
                <p className="text-[16px] font-poppins font-bold text-[#4F46E5] mt-1">{r.percent}%</p>
              </div>
            ))}
            {(!data || !data.results_top?.length) && <p className="text-[14px] text-[#999] col-span-5 text-center py-4">No results published yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const readLocal = (key) => { try { return JSON.parse(localStorage.getItem(`orison_${key}`) || '[]'); } catch { return []; } };

const QuickAction = ({ icon: Icon, label, note, path, tone }) => {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(path)} className="group flex items-center gap-4 rounded-2xl border border-white bg-white/90 p-4 text-left ring-1 ring-slate-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] transition hover:-translate-y-0.5 hover:ring-indigo-200">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><b className="block text-[14px] text-slate-800">{label}</b><span className="block text-[12.5px] text-slate-500">{note}</span></span>
      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
    </button>
  );
};

const WorkspaceHero = ({ title, subtitle, icon: Icon }) => (
  <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#111B3E] via-[#312E81] to-[#4F46E5] p-6 text-white shadow-[0_20px_50px_-20px_rgba(79,70,229,0.6)] sm:p-7">
    <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
    <div className="relative flex items-center gap-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Icon className="h-6 w-6" /></span>
      <div><h1 className="font-poppins text-[22px] font-bold tracking-[-0.03em] sm:text-[26px]">{title}</h1><p className="text-[13.5px] text-white/70">{subtitle}</p></div>
    </div>
  </div>
);

const TeacherDashboard = () => {
  const { data: notices, loading } = useAnalytics('/notifications');
  const consents = readLocal('consent_campaigns');
  const openConsents = consents.filter((c) => c.status !== 'Closed').length;
  const list = Array.isArray(notices) ? notices : notices?.items || [];
  return (
    <>
      <WorkspaceHero title="Good day, Teacher" subtitle="Your class tasks for today — attendance, marks, homework and consent." icon={GraduationCap} />
      <StatGrid loading={loading} items={[
        { label: 'Attendance', value: 'Mark now', icon: CalendarCheck, tint: 'bg-emerald-50 text-emerald-600' },
        { label: 'Open consent forms', value: openConsents, icon: FileSignature, tint: 'bg-indigo-50 text-[#4F46E5]' },
        { label: 'Notices', value: list.length, icon: Bell, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Timetable', value: 'Today', icon: Clock3, tint: 'bg-sky-50 text-sky-600' },
      ]} />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <QuickAction icon={ClipboardCheck} label="Mark attendance" note="Take today's class register" path="/attendance/add" tone="bg-emerald-50 text-emerald-600" />
        <QuickAction icon={Award} label="Enter marks" note="Add exam and test scores" path="/marks/add" tone="bg-violet-50 text-violet-600" />
        <QuickAction icon={NotebookPen} label="Give homework" note="Assign and track completion" path="/homework/add" tone="bg-sky-50 text-sky-600" />
        <QuickAction icon={CalendarDays} label="View timetable" note="Your periods this week" path="/timetable/view" tone="bg-amber-50 text-amber-600" />
        <QuickAction icon={FileSignature} label="Consent forms" note="See which parents replied" path="/consents" tone="bg-indigo-50 text-[#4F46E5]" />
        <QuickAction icon={ScrollText} label="Apply for leave" note="Send a leave request" path="/leave/apply" tone="bg-rose-50 text-rose-600" />
      </div>
    </>
  );
};

const StockDashboard = () => {
  const { data, loading, error, reload } = useAnalytics('/inventory/items');
  if (error) return <ErrorState onRetry={reload} />;
  const items = Array.isArray(data) ? data : [];
  const low = items.filter((i) => Number(i.quantity || 0) <= Number(i.reorder_level || 0));
  const value = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || i.selling_price || 0), 0);
  return (
    <>
      <WorkspaceHero title="Purchase & Stock" subtitle="Uniforms, books and supplies — what's in store and what needs buying." icon={Boxes} />
      <StatGrid loading={loading} items={[
        { label: 'Stock items', value: items.length, icon: Boxes, tint: 'bg-indigo-50 text-[#4F46E5]' },
        { label: 'Low stock', value: low.length, icon: AlertTriangle, tint: 'bg-rose-50 text-rose-600' },
        { label: 'Units in store', value: items.reduce((s, i) => s + Number(i.quantity || 0), 0).toLocaleString('en-IN'), icon: PackagePlus, tint: 'bg-emerald-50 text-emerald-600' },
        { label: 'Stock value', value: fmt(value), icon: BadgeIndianRupee, tint: 'bg-amber-50 text-amber-600' },
      ]} />
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-white bg-white/90 p-5 ring-1 ring-slate-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)]">
          <p className="mb-3 text-[15px] font-semibold text-slate-800">Needs re-ordering</p>
          {low.length === 0 ? <p className="py-6 text-center text-[13px] text-slate-400">All items are above their re-order level.</p> : low.slice(0, 8).map((i) => (
            <div key={i.id || i.item_name} className="flex items-center justify-between border-t border-slate-100 py-2.5 first:border-0">
              <span className="text-[13.5px] font-medium text-slate-700">{i.item_name}</span>
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-bold text-rose-600">{i.quantity} left · min {i.reorder_level}</span>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-3">
          <QuickAction icon={PackagePlus} label="Buy / receive stock" note="Record a purchase" path="/inventory/purchase" tone="bg-emerald-50 text-emerald-600" />
          <QuickAction icon={Users} label="Issue to parent" note="Uniforms, books, kits" path="/inventory/parent-issue" tone="bg-indigo-50 text-[#4F46E5]" />
          <QuickAction icon={ScrollText} label="Stock register" note="Every movement, in order" path="/inventory/register" tone="bg-amber-50 text-amber-600" />
        </div>
      </div>
    </>
  );
};

const LibrarianDashboard = () => {
  const books = readLocal('library_books');
  const issues = readLocal('library_issues');
  const today = new Date().toISOString().slice(0, 10);
  const open = issues.filter((i) => !i.returned_on);
  const overdue = open.filter((i) => i.due_on < today);
  return (
    <>
      <WorkspaceHero title="Library desk" subtitle="Catalogue, loans and overdue returns at a glance." icon={BookOpen} />
      <StatGrid loading={false} items={[
        { label: 'Titles', value: books.length || '—', icon: BookOpen, tint: 'bg-indigo-50 text-[#4F46E5]' },
        { label: 'On loan', value: open.length, icon: BookOpenCheck, tint: 'bg-sky-50 text-sky-600' },
        { label: 'Overdue', value: overdue.length, icon: AlertTriangle, tint: 'bg-rose-50 text-rose-600' },
        { label: 'Returned', value: issues.length - open.length, icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600' },
      ]} />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <QuickAction icon={BookOpen} label="Book catalogue" note="Add or find a book" path="/library" tone="bg-indigo-50 text-[#4F46E5]" />
        <QuickAction icon={BookOpenCheck} label="Issues & returns" note={overdue.length ? `${overdue.length} overdue to chase` : 'Issue or return a book'} path="/library/issues" tone="bg-rose-50 text-rose-600" />
      </div>
    </>
  );
};

const FeeManagerShortcuts = () => (
  <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <QuickAction icon={Wallet} label="Collect fee" note="Take a payment" path="/fee/collect" tone="bg-emerald-50 text-emerald-600" />
    <QuickAction icon={Receipt} label="Receipts" note="Find and reprint" path="/fee/receipts" tone="bg-indigo-50 text-[#4F46E5]" />
    <QuickAction icon={BadgeIndianRupee} label="Record expense" note="Bills and vouchers" path="/expenses/record" tone="bg-amber-50 text-amber-600" />
    <QuickAction icon={Users} label="Staff payroll" note="Salaries this month" path="/hr-payroll" tone="bg-violet-50 text-violet-600" />
  </div>
);

const Dashboard = () => {
  const { auth } = useAuth();
  const role = auth?.role;
  return (
    <Layout>
      {role === 'fee_manager' ? <><FeeManagerShortcuts /><FeeDashboard /></> : role === 'teacher' ? <TeacherDashboard /> : role === 'stock_manager' ? <StockDashboard /> : role === 'librarian' ? <LibrarianDashboard /> : role === 'academic_coordinator' ? <AcademicCoordinatorDashboard /> : role === 'director' ? <DirectorDashboard /> : <><SetupChecklistCard /><AdminDashboard /></>}
    </Layout>
  );
};

export default Dashboard;
