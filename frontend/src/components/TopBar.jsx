import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, ChevronDown, Command, GraduationCap, Loader2, LogOut,
  Search, Settings, ShieldCheck, Users,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const TopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const boxRef = useRef(null);
  const initials = (auth?.name || 'Admin').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const canOpen = (key) => !auth?.menu || auth.menu.includes(key);
  const isDashboard = location.pathname === '/dashboard';
  const workspaceTitle = getWorkspaceTitle(location.pathname);

  useEffect(() => {
    const handler = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setResults(null);
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return undefined; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/search', { params: { q } });
        setResults(data);
      } catch (error) { setResults(null); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const go = (path) => { setQ(''); setResults(null); setMenuOpen(false); navigate(path); };
  const empty = results && !results.students.length && !results.teachers.length && !results.classes.length;

  return (
    <header className={`sticky top-0 z-40 px-6 lg:px-8 ${isDashboard ? 'pt-5' : 'pt-3'}`}>
      <div className={`flex items-center justify-between gap-5 border border-white/80 bg-white/[0.9] px-5 shadow-[0_12px_32px_rgba(30,41,59,0.07)] backdrop-blur-xl ${isDashboard ? 'min-h-[78px] rounded-2xl py-3' : 'min-h-[58px] rounded-xl py-2'}`}>
        <div className="min-w-0">
          {isDashboard ? (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 items-center gap-1.5 rounded-full bg-emerald-50 px-2 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Campus live
                </span>
                <span className="hidden text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-300 xl:inline">2026–27 Academic Workspace</span>
              </div>
              <h1 className="truncate font-poppins text-[19px] font-bold text-slate-900 lg:text-[21px]">
                Welcome back, {auth?.name || 'Admin'} <span aria-hidden="true">👋</span>
              </h1>
              <p className="hidden text-[11px] text-slate-400 sm:block">Your school operations are synced and ready for action.</p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400">Admin workspace</p>
                <h1 className="truncate font-poppins text-[14px] font-bold text-slate-900">{workspaceTitle}</h1>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5" ref={boxRef}>
          <div className="relative hidden md:block">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search students, teachers, classes"
              className="h-10 w-[250px] rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-11 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:w-[300px] focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            />
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[8px] font-semibold text-slate-400"><Command className="h-2.5 w-2.5" />K</span>
            {(results || loading) && q.trim() && (
              <div className="absolute right-0 top-12 max-h-[420px] w-[370px] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
                {loading && <div className="flex items-center gap-2 px-4 py-5 text-[12px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching your school...</div>}
                {!loading && empty && <div className="px-4 py-8 text-center text-[12px] text-slate-400">No results for “{q}”</div>}
                {!loading && results && (
                  <div className="space-y-2">
                    {results.students.length > 0 && <ResultGroup title="Students" icon={Users}>{results.students.map((student) => <ResultButton key={student.id} onClick={() => go('/students/profile')} title={student.name} copy={`${student.class_name} • ${student.id}`} />)}</ResultGroup>}
                    {results.teachers.length > 0 && <ResultGroup title="Teachers" icon={GraduationCap}>{results.teachers.map((teacher) => <ResultButton key={teacher.id} onClick={() => go('/teachers')} title={teacher.name} copy={teacher.subject} />)}</ResultGroup>}
                    {results.classes.length > 0 && <ResultGroup title="Classes" icon={BookOpen}>{results.classes.map((item) => <ResultButton key={item.name} onClick={() => go('/academics')} title={item.name} copy="Open academic workspace" />)}</ResultGroup>}
                  </div>
                )}
              </div>
            )}
          </div>

          {canOpen('notifications') && (
            <button onClick={() => go('/notifications')} aria-label="Open notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4F46E5]">
              <Bell className="h-[17px] w-[17px]" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#635BFF] px-1 text-[8px] font-bold text-white ring-2 ring-white">4</span>
            </button>
          )}
          {canOpen('settings') && <button onClick={() => go('/settings')} aria-label="Open settings" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4F46E5] sm:flex"><Settings className="h-[17px] w-[17px]" /></button>}

          <div className="relative">
            <button onClick={() => setMenuOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2.5 transition hover:border-indigo-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-[10px] font-bold text-white shadow-sm">{initials}</span>
              <div className="hidden text-left lg:block"><p className="max-w-[90px] truncate text-[10px] font-bold text-slate-800">{auth?.name || 'Admin'}</p><p className="text-[8px] capitalize text-slate-400">{(auth?.role || '').replaceAll('_', ' ')}</p></div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
                <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-3 text-white"><p className="text-[11px] font-semibold">{auth?.name || 'Admin'}</p><p className="mt-1 flex items-center gap-1.5 text-[8px] uppercase tracking-wide text-white/50"><ShieldCheck className="h-3 w-3 text-emerald-400" /> Verified staff session</p></div>
                {canOpen('settings') && <MenuButton icon={Settings} label="Workspace settings" onClick={() => go('/settings')} />}
                <button onClick={() => { logout(); navigate('/'); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#4F46E5] transition hover:bg-indigo-50"><LogOut className="h-4 w-4" /> Sign out securely</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const ResultGroup = ({ title, icon: Icon, children }) => <div><p className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400"><Icon className="h-3 w-3" />{title}</p><div className="space-y-0.5">{children}</div></div>;
const ResultButton = ({ title, copy, onClick }) => <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-bold text-[#4F46E5]">{title?.[0]}</span><span><span className="block text-[11px] font-semibold text-slate-700">{title}</span><span className="block text-[9px] text-slate-400">{copy}</span></span></button>;
const MenuButton = ({ icon: Icon, label, onClick }) => <button onClick={onClick} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"><Icon className="h-4 w-4" />{label}</button>;

const getWorkspaceTitle = (pathname) => {
  const sections = [
    ['/management', 'School Operations Center'],
    ['/students', 'Student Management'],
    ['/academics', 'Academics Management'],
    ['/attendance', 'Attendance Management'],
    ['/teachers', 'Teachers Management'],
    ['/staff', 'Staff Management'],
    ['/fees', 'Fee Management'],
    ['/collections', 'Collection Intelligence'],
    ['/exams', 'Exams Management'],
    ['/marks', 'Marks Management'],
    ['/homework/add', 'Add Homework'],
    ['/homework/reports', 'Homework Reports'],
    ['/homework', 'Homework Management'],
    ['/hall-tickets/create', 'Create Hall Ticket'],
    ['/hall-tickets/view', 'View Hall Tickets'],
    ['/leave', 'Leave Management'],
    ['/timetable', 'Timetable Management'],
    ['/inventory', 'Inventory & Expenses'],
    ['/expenses', 'Inventory & Expenses'],
    ['/notifications', 'Notifications'],
    ['/transport', 'Transport Management'],
    ['/visitors', 'Visitor Management'],
    ['/branches', 'Multi-Branch Management'],
    ['/settings', 'Workspace Settings'],
    ['/parent-app', 'Parent App Center'],
  ];
  return sections.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'School Workspace';
};

export default TopBar;
