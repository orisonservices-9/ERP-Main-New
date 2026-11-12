import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, Building2, ChevronDown, Command, GraduationCap, Loader2, LogOut,
  Languages, Menu, Moon, Search, Settings, ShieldCheck, Sun, Users,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { canAccessModule, canAccessPath } from '../roleAccess';
import { getTheme, isDark, setTheme } from '../theme';
import { LANGUAGES, setLang, t, useLang } from '../i18n';
import { NAV_ITEMS } from '../mock';

const TopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout, activeBranch, setActiveBranch } = useAuth();
  const [branches, setBranches] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lang = useLang();
  const [dark, setDark] = useState(() => isDark());
  useEffect(() => {
    const on = () => setDark(isDark());
    window.addEventListener('orison-theme', on);
    return () => window.removeEventListener('orison-theme', on);
  }, []);
  const toggleTheme = () => setTheme(isDark(getTheme()) ? 'light' : 'dark');
  const boxRef = useRef(null);
  const initials = (auth?.name || 'Admin').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const canOpen = (key) => canAccessModule(auth?.role, key);
  const isDashboard = location.pathname === '/dashboard';
  const { section: workspaceSection, title: workspaceTitle } = getPageTitle(location.pathname);
  const dashboardMeta = auth?.role === 'director'
    ? { badge: 'Leadership oversight', subtitle: 'Your school-wide performance and decision signals are ready for review.' }
    : auth?.role === 'academic_coordinator'
      ? { badge: 'Academic workspace', subtitle: 'Academic signals, support plans and classroom quality are ready for action.' }
      : auth?.role === 'fee_manager'
        ? { badge: 'Collection workspace', subtitle: 'Fee accounts, receipts and collection follow-ups are ready for action.' }
        : { badge: '2026–27 School workspace', subtitle: 'Your school operations are synced and ready for action.' };
  const searchPlaceholder = auth?.role === 'director' ? 'Search classes and academic signals' : auth?.role === 'academic_coordinator' ? 'Search classes and subjects' : 'Search students, teachers, classes';

  useEffect(() => {
    if (!auth || !['admin', 'director'].includes(auth.role)) return;
    api.get('/branches/network').then(({ data }) => setBranches((data.branches || []).filter((item) => item.status !== 'Suspended'))).catch(() => setBranches([]));
  }, [auth]);

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
  const visibleResultCount = results ? (
    (canAccessPath(auth?.role, '/students/profile', 'student') ? results.students.length : 0)
    + (canAccessPath(auth?.role, '/teachers/view', 'teachers') ? results.teachers.length : 0)
    + (canAccessModule(auth?.role, 'academics') ? results.classes.length : 0)
  ) : 0;
  const empty = results && visibleResultCount === 0;

  return (
    <header className={`sticky top-0 z-30 px-4 sm:px-6 lg:px-8 ${isDashboard ? 'pt-5' : 'pt-3'}`}>
      <div className={`flex items-center justify-between gap-5 border border-white/80 bg-white/[0.9] px-5 shadow-[0_12px_32px_rgba(30,41,59,0.07)] backdrop-blur-xl ${isDashboard ? 'min-h-[78px] rounded-2xl py-3' : 'min-h-[58px] rounded-xl py-2'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => window.dispatchEvent(new Event('orison-open-menu'))} aria-label="Open menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0">
          {isDashboard ? (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 items-center gap-1.5 rounded-full bg-emerald-50 px-2 text-[12px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Campus live
                </span>
                <span className="hidden text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-300 xl:inline">{dashboardMeta.badge}</span>
              </div>
              <h1 className="truncate font-poppins text-[19px] font-bold text-slate-900 lg:text-[21px]">
                Welcome back, {auth?.name || 'Admin'} <span aria-hidden="true">👋</span>
              </h1>
              <p className="hidden text-[13px] text-slate-400 sm:block">{dashboardMeta.subtitle}</p>
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5] sm:flex">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-slate-400">{t(workspaceSection)}</p>
                <h1 className="truncate font-poppins text-[16px] font-bold leading-6 text-slate-900" title={t(workspaceTitle)}>{t(workspaceTitle)}</h1>
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2" ref={boxRef}>
          {branches.length > 0 && <label className="relative hidden 2xl:block"><Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" /><select value={activeBranch?.id || 'BR-MAIN'} onChange={(event) => { const branch = branches.find((item) => item.id === event.target.value); if (branch) { setActiveBranch({ id: branch.id, name: branch.name, code: branch.code }); window.location.reload(); } }} className="h-10 max-w-[210px] appearance-none rounded-xl border border-indigo-100 bg-indigo-50/70 pl-9 pr-8 text-[12px] font-semibold text-indigo-900 outline-none focus:ring-4 focus:ring-indigo-50">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-indigo-400" /></label>}
          <button type="button" onClick={() => window.dispatchEvent(new Event('orison-open-palette'))} aria-label="Search" title="Search (Ctrl K)" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4F46E5] xl:hidden"><Search className="h-[17px] w-[17px]" /></button>
          {auth?.role !== 'fee_manager' && <div className="relative hidden xl:block">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-[230px] rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-11 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:w-[290px] focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            />
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[12px] font-semibold text-slate-400"><Command className="h-2.5 w-2.5" />K</span>
            {(results || loading) && q.trim() && (
              <div className="absolute right-0 top-12 max-h-[420px] w-[370px] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
                {loading && <div className="flex items-center gap-2 px-4 py-5 text-[13px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching your school...</div>}
                {!loading && empty && <div className="px-4 py-8 text-center text-[13px] text-slate-400">No results for “{q}”</div>}
                {!loading && results && (
                  <div className="space-y-2">
                    {canAccessPath(auth?.role, '/students/profile', 'student') && results.students.length > 0 && <ResultGroup title="Students" icon={Users}>{results.students.map((student) => <ResultButton key={student.id} onClick={() => go(`/students/profile?id=${student.id}`)} title={student.name} copy={`${student.class_name} • ${student.id}`} />)}</ResultGroup>}
                    {canAccessPath(auth?.role, '/teachers/view', 'teachers') && results.teachers.length > 0 && <ResultGroup title="Teachers" icon={GraduationCap}>{results.teachers.map((teacher) => <ResultButton key={teacher.id} onClick={() => go('/teachers/view')} title={teacher.name} copy={teacher.subject} />)}</ResultGroup>}
                    {canAccessModule(auth?.role, 'academics') && results.classes.length > 0 && <ResultGroup title="Classes" icon={BookOpen}>{results.classes.map((item) => <ResultButton key={item.name} onClick={() => go(canAccessPath(auth?.role, '/academics', 'academics') ? '/academics' : canAccessPath(auth?.role, '/academics/syllabus', 'academics') ? '/academics/syllabus' : '/academics/action-center')} title={item.name} copy="Open academic workspace" />)}</ResultGroup>}
                  </div>
                )}
              </div>
            )}
          </div>}

          <label className="relative hidden xl:block" title={t('Language')}>
            <Languages className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <select aria-label={t('Language')} value={lang} onChange={(event) => setLang(event.target.value)}
              className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-[13px] font-semibold text-slate-600 outline-none hover:border-indigo-100 focus:ring-2 focus:ring-indigo-100">
              {Object.entries(LANGUAGES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <button onClick={toggleTheme} aria-label={dark ? t('Light mode') : t('Dark mode')} title={dark ? t('Light mode') : t('Dark mode')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4F46E5]">
            {dark ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          </button>
          {canOpen('notifications') && (
            <button onClick={() => go('/notifications')} aria-label="Open notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4F46E5]">
              <Bell className="h-[17px] w-[17px]" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#635BFF] px-1 text-[12px] font-bold text-white ring-2 ring-white">4</span>
            </button>
          )}
          {canOpen('settings') && <button onClick={() => go('/settings')} aria-label="Open settings" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4F46E5] 2xl:flex"><Settings className="h-[17px] w-[17px]" /></button>}

          <div className="relative">
            <button onClick={() => setMenuOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2.5 transition hover:border-indigo-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-[12px] font-bold text-white shadow-sm">{initials}</span>
              <div className="hidden text-left 2xl:block"><p className="max-w-[110px] truncate text-[13px] font-bold text-slate-800">{auth?.name || 'Admin'}</p><p className="text-[12px] capitalize text-slate-400">{(auth?.role || '').replaceAll('_', ' ')}</p></div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
                <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-3 text-white"><p className="text-[13px] font-semibold">{auth?.name || 'Admin'}</p><p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/60"><ShieldCheck className="h-3 w-3 text-emerald-400" /> Verified staff session</p></div>
                <div className="mt-2 px-3 xl:hidden"><p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"><Languages className="h-3.5 w-3.5" />{t('Language')}</p><div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">{Object.entries(LANGUAGES).map(([code, label]) => <button key={code} onClick={() => setLang(code)} className={`rounded-lg px-1 py-1.5 text-[12px] font-semibold ${lang === code ? 'bg-white text-[#4F46E5] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div></div>
                {canOpen('settings') && <MenuButton icon={Settings} label="Workspace settings" onClick={() => go('/settings')} />}
                <button onClick={() => { logout(); navigate('/'); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#4F46E5] transition hover:bg-indigo-50"><LogOut className="h-4 w-4" /> Sign out securely</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const ResultGroup = ({ title, icon: Icon, children }) => <div><p className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400"><Icon className="h-3 w-3" />{title}</p><div className="space-y-0.5">{children}</div></div>;
const ResultButton = ({ title, copy, onClick }) => <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[12px] font-bold text-[#4F46E5]">{title?.[0]}</span><span><span className="block text-[13px] font-semibold text-slate-700">{title}</span><span className="block text-[12px] text-slate-400">{copy}</span></span></button>;
const MenuButton = ({ icon: Icon, label, onClick }) => <button onClick={onClick} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"><Icon className="h-4 w-4" />{label}</button>;

// Page title = the menu label of the exact screen; the section (parent menu) shows above it.
const getPageTitle = (pathname) => {
  for (const item of NAV_ITEMS) {
    if (item.path && pathname === item.path) return { section: 'School workspace', title: item.label };
    const child = (item.children || []).find((c) => c.path === pathname);
    if (child) return { section: item.label, title: child.label === 'Dashboard' ? `${item.label.replace(/ Management$/, '')} Dashboard` : child.label };
  }
  const extra = {
    '/students/profile': ['Student Management', 'Student Profile'], '/students/add/new': ['Student Management', 'New Admission Form'],
    '/fee/create': ['Fee Management', 'Create Fee Structure'], '/settings': ['School workspace', 'Workspace Settings'],
  };
  if (extra[pathname]) return { section: extra[pathname][0], title: extra[pathname][1] };
  return { section: 'School workspace', title: getWorkspaceTitle(pathname) };
};

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
    ['/visitor', 'Visitor Management'],
    ['/multi-branch', 'Multi-Branch Management'],
    ['/settings', 'Workspace Settings'],
    ['/parent-app', 'Parent App Center'],
  ];
  return sections.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'School Workspace';
};

export default TopBar;
