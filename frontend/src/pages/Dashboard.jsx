import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Users, Wallet, CalendarCheck, GraduationCap, ArrowUpRight, TrendingUp, AlertTriangle, Receipt, Award, Percent, RefreshCw, Sparkles, Bell, BookOpenCheck, Boxes, Bus, ChevronLeft, ChevronRight, CheckCircle2, CircleDollarSign, School, UserCheck, CalendarDays, Clock3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';

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
                {s.delta && <span className="flex items-center gap-1 text-[12px] font-semibold text-green-600"><TrendingUp className="w-3.5 h-3.5" /> {s.delta}</span>}
              </div>
              <p className="text-[26px] font-poppins font-bold tracking-[-0.04em] text-slate-900 mt-4">{s.value}</p>
              <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
            </div>
          );
        })}
  </div>
);

const ErrorState = ({ onRetry }) => (
  <div data-testid="dashboard-error" className="bg-white/90 rounded-2xl border border-indigo-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] p-12 text-center">
    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-[#4F46E5]" /></div>
    <p className="text-[15px] font-semibold text-[#1a1a1a]">Couldn't load dashboard data</p>
    <p className="text-[13px] text-[#8a8a8a] mt-1">Please check your connection and try again.</p>
    <button onClick={onRetry} data-testid="dashboard-retry-btn" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-5 py-2.5 text-[12px] font-bold text-white shadow-[0_9px_18px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5">
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
      <div className="h-[220px] flex items-center justify-center text-[13px] text-[#999]">{emptyText || 'No data yet.'}</div>
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
        <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CalendarDays className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-[11px] font-bold text-slate-800">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">Live calendar · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p></div></div>
        <button type="button" onClick={resetToday} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[9px] font-bold text-indigo-600">Today</button>
      </div>
      <div className="mt-3 flex items-center justify-between"><h2 className="font-poppins text-[14px] font-bold text-slate-900">{visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><div className="flex gap-1"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><ChevronLeft className="h-3.5 w-3.5" /></button><button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><ChevronRight className="h-3.5 w-3.5" /></button></div></div>
      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <div key={`${day}-${index}`} className="py-1 text-[8px] font-bold text-slate-400">{day}</div>)}{days.map((day, index) => { const isToday = isCurrentMonth && day === now.getDate(); return <div key={`${day || 'empty'}-${index}`} className={`flex h-6 items-center justify-center rounded-md text-[9px] font-semibold ${!day ? '' : isToday ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-50'}`}>{day || ''}</div>; })}</div>
    </section>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAnalytics('/analytics/dashboard');
  const quick = [
    { label: 'Add student', hint: 'Single or bulk admission', path: '/students/add', icon: Users },
    { label: 'Mark attendance', hint: 'Students, teachers & staff', path: '/attendance/add', icon: CalendarCheck },
    { label: 'Collect fee', hint: 'Search and issue receipt', path: '/fee/collect', icon: CircleDollarSign },
    { label: 'Create exam', hint: 'Schedule an assessment', path: '/exams/create', icon: CalendarDays },
  ];
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
  const activityMeta = (event) => {
    const text = `${event.title || ''} ${event.body || ''}`.toLowerCase();
    const status = event.type === 'warning'
      ? { statusLabel: 'Needs attention', pill: 'bg-amber-50 text-amber-700' }
      : event.type === 'success'
        ? { statusLabel: 'Completed', pill: 'bg-emerald-50 text-emerald-700' }
        : { statusLabel: 'Update', pill: 'bg-indigo-50 text-indigo-700' };
    let department = { department: 'School Operations', icon: School, iconTone: 'bg-violet-100 text-violet-700 ring-violet-200' };
    if (/fee|payment|collection|expense|invoice|receipt/.test(text)) department = { department: 'Finance', icon: Wallet, iconTone: 'bg-emerald-100 text-emerald-700 ring-emerald-200' };
    else if (/attendance|absent|present/.test(text)) department = { department: 'Attendance', icon: CalendarCheck, iconTone: 'bg-blue-100 text-blue-700 ring-blue-200' };
    else if (/exam|result|marks|syllabus|curriculum|academic|homework/.test(text)) department = { department: 'Academics', icon: BookOpenCheck, iconTone: 'bg-amber-100 text-amber-700 ring-amber-200' };
    else if (/student|admission|promotion|transfer/.test(text)) department = { department: 'Students', icon: Users, iconTone: 'bg-indigo-100 text-indigo-700 ring-indigo-200' };
    else if (/teacher|staff|leave|payroll|employee/.test(text)) department = { department: 'People', icon: GraduationCap, iconTone: 'bg-cyan-100 text-cyan-700 ring-cyan-200' };
    else if (/transport|route|bus|driver/.test(text)) department = { department: 'Transport', icon: Bus, iconTone: 'bg-orange-100 text-orange-700 ring-orange-200' };
    else if (/inventory|stock|purchase|item|supplier/.test(text)) department = { department: 'Inventory', icon: Boxes, iconTone: 'bg-rose-100 text-rose-700 ring-rose-200' };
    else if (/notification|message|broadcast|alert/.test(text)) department = { department: 'Communications', icon: Bell, iconTone: 'bg-pink-100 text-pink-700 ring-pink-200' };
    return { ...department, ...status };
  };
  const activityTime = (event) => {
    if (!event.created) return 'Recent update';
    const date = new Date(event.created);
    return Number.isNaN(date.getTime()) ? 'Recent update' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const hasAttendanceTrend = data?.attendance_trend?.some((item) => item.rate != null);
  const collection = data?.stats || {};
  const collectionProgress = Math.max(0, Math.min(100, Number(collection.collection_efficiency || 0)));
  const formattedDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(118deg,#111827_0%,#272B67_54%,#5B4FE9_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(49,46,129,0.22)] sm:px-8">
        <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full border border-white/10 bg-white/5" />
        <div className="absolute -bottom-28 right-52 h-56 w-56 rounded-full bg-violet-400/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-100">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live school pulse</span>
              <span>{data?.academic_year || 'Academic year not configured'}</span>
            </div>
            <div className="mt-4 flex items-center gap-3"><Sparkles className="h-6 w-6 text-violet-300" /><h1 className="font-poppins text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">School Command Center</h1></div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-indigo-200">Today</p><p className="mt-1 text-[12px] font-semibold">{formattedDate}</p></div>
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
              ].map((item) => <button key={item.label} onClick={() => navigate(item.path)} className="group relative overflow-hidden rounded-[22px] border border-white bg-gradient-to-br from-white to-slate-50/80 p-4 text-left ring-1 ring-slate-100 shadow-[0_12px_35px_rgba(15,23,42,0.055)] transition hover:-translate-y-1 hover:ring-indigo-200 hover:shadow-[0_18px_45px_rgba(79,70,229,0.11)]"><span className="absolute -right-7 -top-7 h-20 w-20 rounded-full bg-indigo-50/70"/><div className="relative flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-white shadow-lg`}><item.icon className="h-4 w-4" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" /></div><div className="relative mt-3 flex items-end justify-between gap-3"><div><p className="font-poppins text-[23px] font-bold tracking-[-0.04em] text-slate-950">{item.value}</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</p></div><p className="max-w-[145px] text-right text-[9px] leading-4 text-slate-500">{item.note}</p></div></button>)}
            </div>
          )}
        </div>
        <div className="flex xl:col-span-4"><LiveCalendar /></div>
      </section>

      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)] xl:col-span-7">
          <div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-indigo-500">Management queue</p><h2 className="mt-1 font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Today’s priority actions</h2><p className="mt-1 text-[10px] text-slate-400">Highest-impact issues, automatically ranked from live records.</p></div><button onClick={reload} className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:text-indigo-600"><RefreshCw className="h-4 w-4" /></button></div>
          <div className="mt-5 divide-y divide-slate-100">
            {(data?.priorities || []).map((item, index) => {
              const department = priorityDepartment(item);
              const DepartmentIcon = department.icon;
              const level = priorityLevel[item.level] || priorityLevel.low;
              return <button key={`${item.title}-${index}`} onClick={() => navigate(item.path)} className="group flex w-full items-center gap-4 py-4 text-left">
                <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${department.tone}`}><DepartmentIcon className="h-5 w-5" /><span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${level.badge}`}>{item.level === 'clear' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}</span></span>
                <span className="min-w-0 flex-1"><span className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">{department.label}</span><span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${level.pill}`}>{level.label}</span></span><span className="block text-[12px] font-bold text-slate-800">{item.title}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{item.detail}</span></span>
                {item.value > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{item.value}</span>}<ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500" />
              </button>;
            })}
          </div>
        </div>

        <div className="space-y-5 xl:col-span-5">
          <div className="rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-600">Finance health</p><div className="mt-1 flex items-end justify-between"><div><h2 className="font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Fee collection</h2><p className="mt-1 text-[10px] text-slate-400">Expected versus realised for the current data set.</p></div><span className="text-[22px] font-bold text-emerald-600">{collectionProgress}%</span></div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[linear-gradient(90deg,#10B981,#14B8A6)] transition-all" style={{ width: `${collectionProgress}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-emerald-600">Collected</p><p className="mt-1.5 text-[14px] font-bold text-slate-900">{fmt(collection.fees_collected)}</p></div><div className="rounded-xl bg-rose-50 p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-rose-500">Outstanding</p><p className="mt-1.5 text-[14px] font-bold text-slate-900">{fmt(collection.fees_outstanding)}</p></div></div>
            <button onClick={() => navigate('/collections')} className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-indigo-700"><span>Open collection intelligence</span><ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-indigo-500">Daily shortcuts</p><h2 className="mt-1 font-poppins text-[16px] font-bold text-slate-950">Quick actions</h2></div><Sparkles className="h-4 w-4 text-indigo-300" /></div><div className="mt-3 grid grid-cols-2 gap-2">{quick.map((item) => <button key={item.path} onClick={() => navigate(item.path)} className="group flex items-center gap-2 rounded-xl border border-slate-100 p-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600"><item.icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block truncate text-[9px] font-bold text-slate-700">{item.label}</span><span className="mt-0.5 block truncate text-[8px] text-slate-400">{item.hint}</span></span></button>)}</div></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)] xl:col-span-7">
          <div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-blue-600">7-day view</p><h2 className="mt-1 font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Attendance movement</h2></div><button onClick={() => navigate('/attendance/reports')} className="text-[10px] font-bold text-indigo-600">View report →</button></div>
          {hasAttendanceTrend ? <div className="mt-5"><ResponsiveContainer width="100%" height={210}><AreaChart data={data?.attendance_trend || []} margin={{ left: -24, right: 8, top: 8 }}><defs><linearGradient id="adminAtt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.30} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value}%`, 'Attendance']} contentStyle={{ borderRadius: 14, border: '1px solid #E2E8F0', fontSize: 11 }} /><Area connectNulls type="monotone" dataKey="rate" stroke="#4F46E5" strokeWidth={3} fill="url(#adminAtt)" /></AreaChart></ResponsiveContainer></div> : <div className="mt-5 flex h-[210px] flex-col items-center justify-center rounded-2xl bg-slate-50"><CalendarCheck className="h-7 w-7 text-slate-300" /><p className="mt-3 text-[11px] font-semibold text-slate-500">No attendance history yet</p><button onClick={() => navigate('/attendance/add')} className="mt-2 text-[10px] font-bold text-indigo-600">Mark today’s attendance</button></div>}
        </div>

        <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.055)] xl:col-span-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-violet-600">Learning operations</p><h2 className="mt-1 font-poppins text-[19px] font-bold tracking-[-0.03em] text-slate-950">Academic pulse</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">{[
            { label: 'Upcoming exams', value: data?.academic_pulse?.upcoming_exams || 0, icon: CalendarDays, path: '/exams/view', tone: 'bg-indigo-50 text-indigo-600' },
            { label: 'Syllabus behind', value: data?.academic_pulse?.syllabus_behind || 0, icon: Clock3, path: '/academics/syllabus', tone: 'bg-amber-50 text-amber-600' },
            { label: 'Open interventions', value: data?.academic_pulse?.open_interventions || 0, icon: BookOpenCheck, path: '/academics/interventions', tone: 'bg-rose-50 text-rose-600' },
            { label: 'Teacher allocation', value: `${data?.academic_pulse?.teacher_allocation_coverage || 0}%`, icon: School, path: '/teachers/allocations', tone: 'bg-emerald-50 text-emerald-600' },
          ].map((item) => <button key={item.label} onClick={() => navigate(item.path)} className="rounded-2xl border border-slate-100 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/30"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}><item.icon className="h-4 w-4" /></span><p className="mt-3 text-[18px] font-bold text-slate-900">{item.value}</p><p className="mt-1 text-[9px] font-semibold text-slate-400">{item.label}</p></button>)}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.055)]">
        <div className="flex flex-col justify-between gap-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 px-6 py-5 text-white sm:flex-row sm:items-center"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-200">Live audit trail</p><h2 className="mt-1 font-poppins text-[18px] font-bold">Recent school activity</h2><p className="mt-1 text-[10px] text-indigo-100/65">A clear record of the latest completed actions and operational alerts.</p></div><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2"><Bell className="h-4 w-4 text-indigo-200" /><span className="text-[10px] font-bold">{(data?.recent_activity || []).length} recent updates</span></div></div>
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">{(data?.recent_activity || []).length ? data.recent_activity.slice(0, 6).map((event, index) => {
          const meta = activityMeta(event);
          const ActivityIcon = meta.icon;
          return <article key={`${event.id || event.title}-${index}`} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-[0_12px_28px_rgba(79,70,229,0.08)]"><span className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-indigo-50/60" /><div className="relative flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.iconTone}`}><ActivityIcon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="flex flex-wrap items-center gap-1.5"><span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">{meta.department}</span><span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-wide ${meta.pill}`}>{meta.statusLabel}</span></span><time className="text-[8px] font-semibold text-slate-400">{activityTime(event)}</time></div><h3 className="mt-2 text-[11px] font-bold text-slate-800">{event.title}</h3><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">{event.body}</p></div></div></article>;
        }) : <div className="rounded-2xl bg-slate-50 py-10 text-center md:col-span-2"><Bell className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-[10px] font-semibold text-slate-400">Activity will appear as school operations are completed.</p></div>}</div>
      </section>
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
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v / 100000}L`} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
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
            {(data?.method_split || []).map((e, i) => <span key={i} className="flex items-center gap-1.5 text-[11px] text-[#888]"><span className="w-2 h-2 rounded-full" style={{ background: PIE[i % PIE.length] }} /> {e.name}</span>)}
          </div>
        </ChartCard>
        <ChartCard title="Top Outstanding Dues" loading={loading} empty={!!data && !data.top_dues?.length} emptyText="No pending dues 🎉">
          <div className="space-y-3">
            {(data?.top_dues || []).map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3"><img src={d.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /><span className="text-[13px] font-medium text-[#333]">{d.name}</span></div>
                <span className="text-[13px] font-bold text-[#4F46E5]">{fmt(d.due)}</span>
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
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-200">Academic Coordinator Workspace</p><h1 className="mt-2 font-poppins text-[28px] font-bold tracking-[-0.04em]">Academic performance at a glance</h1><p className="mt-2 max-w-2xl text-[12px] leading-6 text-indigo-100/75">Monitor learning outcomes, syllabus progress and students requiring academic support.</p></div>
        <button onClick={() => navigate('/academics/action-center')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[11px] font-bold text-indigo-900 shadow-lg"><BookOpenCheck className="h-4 w-4" /> Open Academic Action Center</button>
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
              <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="score" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Academic Workbench" loading={loading} empty={false}>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">{[
            { label: 'Academic Setup', path: '/academics', icon: School },
            { label: 'Curriculum & Syllabus', path: '/academics/syllabus', icon: BookOpenCheck },
            { label: 'Student Health Signals', path: '/academics/student-health', icon: UserCheck },
            { label: 'Send Notification', path: '/notifications/send', icon: Bell },
          ].map((item) => <button key={item.path} onClick={() => navigate(item.path)} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><item.icon className="h-4 w-4" /></span><span className="text-[11px] font-bold text-slate-700">{item.label}</span><ChevronRight className="ml-auto h-4 w-4 text-slate-300" /></button>)}</div>
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
                <p className="text-[11px] text-[#a0a0a0]">Rank #{r.rank}</p>
                <p className="text-[13px] font-semibold text-[#1a1a1a] mt-1 truncate">{r.name}</p>
                <p className="text-[16px] font-poppins font-bold text-[#4F46E5] mt-1">{r.percent}%</p>
              </div>
            ))}
            {(!data || !data.results_top?.length) && <p className="text-[13px] text-[#999] col-span-5 text-center py-4">No results published yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { auth } = useAuth();
  const role = auth?.role;
  return (
    <Layout>
      {role === 'fee_manager' ? <FeeDashboard /> : role === 'academic_coordinator' ? <AcademicCoordinatorDashboard /> : <AdminDashboard />}
    </Layout>
  );
};

export default Dashboard;
