import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, Circle, Rocket, X } from 'lucide-react';
import api from '../api';

// One place that tells a new school what to set up, in order.
// Every other screen can stay quiet about setup because this checklist covers it.
const get = (url) => api.get(url).then(({ data }) => data).catch(() => null);
const list = (data) => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);

export const useSetupProgress = () => {
  const [state, setState] = useState({ loading: true, steps: [] });
  useEffect(() => {
    let alive = true;
    Promise.all([
      get('/academic-structure'), get('/teachers'), get('/teacher-allocations'),
      get('/students'), get('/fees/structures'), get('/timetable-periods'),
    ]).then(([structure, teachers, allocations, students, fees, periods]) => {
      if (!alive) return;
      const classes = structure?.classes || [];
      const sections = classes.flatMap((c) => c.sections || []);
      const hasSubjects = sections.some((s) => (s.subjects || []).length) || classes.some((c) => (c.subjects || []).length);
      const steps = [
        { key: 'year', title: 'Academic year and board', note: 'Set the year (e.g. 2026–27), board and terms.', done: !!structure?.academic_year, path: '/academics' },
        { key: 'classes', title: 'Classes and sections', note: 'Add every class with its sections.', done: classes.length > 0, path: '/academics' },
        { key: 'subjects', title: 'Subjects for each section', note: 'Marks, exams and timetable use these.', done: hasSubjects, path: '/academics' },
        { key: 'teachers', title: 'Add teachers', note: 'Add one by one or upload the CSV.', done: list(teachers).length > 0, path: '/teachers/add' },
        { key: 'allocations', title: 'Assign teachers to classes', note: 'Who teaches which subject, in which section.', done: list(allocations).length > 0, path: '/teachers/assign' },
        { key: 'students', title: 'Add students', note: 'Admissions or bulk upload by class.', done: list(students).length > 0, path: '/students/add' },
        { key: 'fees', title: 'Create the fee structure', note: 'Fee heads, amounts and due dates.', done: list(fees).length > 0, path: '/fee/create' },
        { key: 'timetable', title: 'Build the timetable', note: 'Periods per day for each section.', done: list(periods).length > 0, path: '/timetable/create' },
      ];
      setState({ loading: false, steps });
    });
    return () => { alive = false; };
  }, []);
  const done = state.steps.filter((s) => s.done).length;
  return { ...state, done, total: state.steps.length, complete: !state.loading && done === state.steps.length };
};

const Ring = ({ value, total }) => {
  const pct = total ? value / total : 0;
  const r = 22; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="#a5f3fc" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
    </svg>
  );
};

// Full checklist card (Dashboard).
export const SetupChecklistCard = () => {
  const navigate = useNavigate();
  const { loading, steps, done, total, complete } = useSetupProgress();
  const [open, setOpen] = useState(true);
  if (loading || complete) return null;
  const next = steps.find((s) => !s.done);
  return (
    <section className="mb-6 overflow-hidden rounded-[26px] bg-white shadow-[0_18px_45px_-20px_rgba(15,23,42,0.25)] ring-1 ring-slate-100" data-testid="setup-checklist">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-[#0F1736] via-[#1E1B4B] to-[#4338CA] p-5 text-white sm:flex-row sm:items-center sm:p-6">
        <div className="relative flex shrink-0 items-center justify-center"><Ring value={done} total={total} /><b className="absolute font-poppins text-[13px]">{done}/{total}</b></div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-cyan-200"><Rocket className="h-3.5 w-3.5" />Getting started</p>
          <h2 className="mt-1 font-poppins text-[20px] font-bold tracking-[-0.02em]">Finish setting up your school</h2>
          <p className="mt-0.5 text-[13px] text-indigo-100/75">Do these in order. Attendance, exams, fees and the parent app all depend on them.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {next && <button onClick={() => navigate(next.path)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-bold text-[#4338CA] shadow-sm transition hover:-translate-y-0.5">Next: {next.title}<ArrowRight className="h-4 w-4" /></button>}
          <button onClick={() => setOpen((v) => !v)} aria-label={open ? 'Hide steps' : 'Show steps'} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 hover:bg-white/20"><ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>
      {open && <ol className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.key} className="bg-white">
            <button onClick={() => navigate(step.path)} className={`group flex h-full w-full items-start gap-3 p-4 text-left transition hover:bg-indigo-50/50 ${step === next ? 'bg-indigo-50/40' : ''}`}>
              {step.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${step === next ? 'bg-[#4F46E5] text-white' : 'border-2 border-slate-200 text-slate-400'}`}>{index + 1}</span>}
              <span className="min-w-0">
                <b className={`block text-[13.5px] ${step.done ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800 group-hover:text-indigo-700'}`}>{step.title}</b>
                <span className="mt-0.5 block text-[12.5px] leading-5 text-slate-500">{step.note}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>}
    </section>
  );
};

// Slim reminder shown on every other admin screen until setup is complete.
export const SetupReminderBar = () => {
  const navigate = useNavigate();
  const { loading, steps, done, total, complete } = useSetupProgress();
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('orison_setup_bar_hidden') === '1'; } catch { return false; } });
  if (loading || complete || hidden) return null;
  const next = steps.find((s) => !s.done);
  const hide = () => { setHidden(true); try { sessionStorage.setItem('orison_setup_bar_hidden', '1'); } catch { /* ignore */ } };
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-2.5 text-[13px] text-indigo-900">
      <Circle className="h-3.5 w-3.5 fill-indigo-500 text-indigo-500" />
      <span className="font-semibold">School setup: {done} of {total} done.</span>
      {next && <span className="text-indigo-700/80">Next step — {next.title.toLowerCase()}.</span>}
      <span className="ml-auto flex items-center gap-1">
        {next && <button onClick={() => navigate(next.path)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-bold text-[#4338CA] hover:bg-white">Continue<ArrowRight className="h-3.5 w-3.5" /></button>}
        <button onClick={() => navigate('/dashboard')} className="rounded-lg px-2.5 py-1.5 font-semibold text-indigo-700 hover:bg-white">See checklist</button>
        <button onClick={hide} aria-label="Hide for now" className="rounded-lg p-1.5 text-indigo-400 hover:bg-white hover:text-indigo-700"><X className="h-3.5 w-3.5" /></button>
      </span>
    </div>
  );
};

export default SetupChecklistCard;
