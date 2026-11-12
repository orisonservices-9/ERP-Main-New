import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, Search, Users, Zap } from 'lucide-react';
import api from '../api';
import { NAV_ITEMS } from '../mock';
import { useAuth } from '../context/AuthContext';
import { canAccessPath, visibleNavigation } from '../roleAccess';
import { t } from '../i18n';

// Ctrl/⌘ + K quick launcher: jump to any screen, run a common action, or open a student.
const QUICK_ACTIONS = [
  { label: 'Collect a fee', path: '/fee/collect', key: 'fee' },
  { label: 'Mark today\'s attendance', path: '/attendance/add', key: 'attendance' },
  { label: 'Add a new student', path: '/students/add/new', key: 'student' },
  { label: 'Enter exam marks', path: '/marks/add', key: 'marks' },
  { label: 'Send a notification to parents', path: '/notifications/send', key: 'notifications' },
  { label: 'Register a visitor', path: '/visitor/register', key: 'visitor' },
  { label: 'Issue a certificate (TC / bonafide)', path: '/certificates', key: 'certificates' },
  { label: 'Issue a library book', path: '/library', key: 'library' },
];

const CommandPalette = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [students, setStudents] = useState([]);
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('orison-open-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('orison-open-palette', onOpen); };
  }, []);

  useEffect(() => { if (open) { setQ(''); setIndex(0); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2 || !canAccessPath(auth?.role, '/students/profile', 'student')) { setStudents([]); return undefined; }
    const timer = setTimeout(() => {
      api.get('/search', { params: { q } }).then(({ data }) => setStudents((data?.students || []).slice(0, 5))).catch(() => setStudents([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, open, auth?.role]);

  const screens = useMemo(() => visibleNavigation(auth?.role, NAV_ITEMS).flatMap((item) => (
    item.children ? item.children.map((c) => ({ label: `${t(item.label)} › ${t(c.label)}`, path: c.path })) : [{ label: t(item.label), path: item.path }]
  )), [auth?.role]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (label) => !term || term.split(/\s+/).every((w) => label.toLowerCase().includes(w));
    const actions = QUICK_ACTIONS.filter((a) => canAccessPath(auth?.role, a.path, a.key) && match(a.label)).map((a) => ({ ...a, group: t('Quick actions'), icon: Zap }));
    const people = students.map((s) => ({ label: s.name, hint: `${s.class_name || ''} · ${s.id}`, path: `/students/profile?id=${s.id}`, group: t('Students'), icon: Users }));
    const pages = screens.filter((s) => match(s.label)).slice(0, term ? 12 : 6).map((s) => ({ ...s, group: t('Go to'), icon: ArrowRight }));
    return [...people, ...actions, ...pages];
  }, [q, students, screens, auth?.role]);

  useEffect(() => { setIndex(0); }, [q]);
  if (!open) return null;

  const run = (item) => { if (!item) return; setOpen(false); navigate(item.path); };
  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Quick search" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-5 w-5 text-slate-400" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); run(results[index]); }
            }}
            placeholder={t('Search screens, actions or a student name…')} className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400" />
          <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[12px] text-slate-400">Esc</kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-8 text-center text-[14px] text-slate-500">Nothing matches “{q}”. Try a module name like “fees” or a student name.</p>}
          {results.map((item, i) => {
            const Icon = item.icon;
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <React.Fragment key={`${item.group}-${item.path}-${item.label}`}>
                {header && <p className="px-3 pb-1 pt-3 text-[12px] font-bold uppercase tracking-wider text-slate-400">{header}</p>}
                <button onMouseEnter={() => setIndex(i)} onClick={() => run(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] ${i === index ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700'}`}>
                  <Icon className={`h-4 w-4 ${i === index ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="truncate text-[12px] text-slate-400">{item.hint}</span>}
                  {i === index && <CornerDownLeft className="h-4 w-4 text-indigo-400" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
