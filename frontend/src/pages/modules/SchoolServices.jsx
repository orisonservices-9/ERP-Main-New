import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, BedDouble, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Download, FileText,
  Fingerprint, Images, Info, Landmark, Library, ListChecks, MapPin, MessageCircle, MessageSquareHeart, Plus,
  Printer, Search, ShieldCheck, Sparkles, Star, Trash2, Undo2, Users, X,
} from 'lucide-react';
import Layout from '../../components/Layout';
import { askConfirm, notify } from '../../components/AppFeedback';
import api from '../../api';

/* =========================================================================
 * School services — Compliance, Certificates, ID cards, Consent forms,
 * Library, Hostel, Events & gallery, Surveys.
 * Records are kept per device (localStorage) by useLocalRecords until the
 * matching server collections exist. Student data comes from GET /students.
 * ====================================================================== */

const SCHOOL = { name: 'Orison International School', campus: 'Main Campus', address: 'Hyderabad, Telangana', affiliation: 'CBSE' };
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const uid = (p) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const classLabel = (s) => [s?.class_name, s?.section].filter(Boolean).join(' · ');
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const useLocalRecords = (key, seed = []) => {
  const storageKey = `orison_${key}`;
  const [items, setItems] = useState(() => { try { const r = localStorage.getItem(storageKey); return r ? JSON.parse(r) : seed; } catch { return seed; } });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* storage full */ } }, [items, storageKey]);
  return {
    items, setItems,
    add: (item) => setItems((l) => [item, ...l]),
    update: (id, patch) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x))),
    remove: (id) => setItems((l) => l.filter((x) => x.id !== id)),
  };
};

export const useStudents = () => {
  const [students, setStudents] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get('/students').then(({ data }) => alive && setStudents(Array.isArray(data) ? data : [])).catch(() => alive && setStudents([]));
    return () => { alive = false; };
  }, []);
  return students;
};

const downloadCsv = (filename, columns, rows) => {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.map((c) => q(c.label)).join(','), ...rows.map((r) => columns.map((c) => q(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const openPrintWindow = (title, body, css = '') => {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) { notify('Allow pop-ups for this site to print.', 'error'); return; }
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>*{box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:0;padding:24px}.sans{font-family:Inter,Arial,sans-serif}${css}@media print{body{padding:0}.noprint{display:none}}</style></head><body>${body}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
};

/* ============================== DESIGN KIT ============================== */
const cx = (...c) => c.filter(Boolean).join(' ');
const TONES = {
  indigo: 'from-[#1E1B4B] via-[#4338CA] to-[#7C3AED]',
  teal: 'from-[#042F2E] via-[#0F766E] to-[#14B8A6]',
  rose: 'from-[#4C0519] via-[#BE185D] to-[#F472B6]',
  amber: 'from-[#451A03] via-[#B45309] to-[#F59E0B]',
  sky: 'from-[#0C1E3E] via-[#1D4ED8] to-[#38BDF8]',
  violet: 'from-[#2E1065] via-[#6D28D9] to-[#A78BFA]',
};

const Hero = ({ icon: Icon, eyebrow, title, text, tone = 'indigo', stats = [], actions }) => (
  <section className={cx('relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br p-6 text-white shadow-[0_24px_60px_rgba(49,46,129,0.28)] sm:p-8', TONES[tone])}>
    <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
    <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur">
          <Icon className="h-3.5 w-3.5" /> {eyebrow}
        </div>
        <h1 className="font-poppins text-[28px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]">{title}</h1>
        <p className="mt-2 text-[15px] leading-6 text-white/80">{text}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
    {stats.length > 0 && (
      <div className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <p className="font-poppins text-[24px] font-bold leading-none">{s.value}</p>
            <p className="mt-1.5 text-[13px] text-white/75">{s.label}</p>
          </div>
        ))}
      </div>
    )}
  </section>
);

const HeroBtn = ({ icon: Icon, children, onClick, light }) => (
  <button onClick={onClick} className={cx('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition', light ? 'bg-white text-indigo-700 shadow-lg hover:bg-indigo-50' : 'border border-white/25 bg-white/10 text-white hover:bg-white/20')}>
    {Icon && <Icon className="h-4 w-4" />}{children}
  </button>
);

const Btn = ({ icon: Icon, children, onClick, variant = 'primary', className = '', type = 'button', disabled }) => (
  <button type={type} disabled={disabled} onClick={onClick} className={cx('inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' && 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_10px_22px_rgba(79,70,229,0.28)] hover:brightness-110',
    variant === 'outline' && 'border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700',
    variant === 'ghost' && 'text-indigo-700 hover:bg-indigo-50',
    variant === 'danger' && 'border border-red-200 bg-white text-red-600 hover:bg-red-50', className)}>
    {Icon && <Icon className="h-4 w-4" />}{children}
  </button>
);

const Panel = ({ title, subtitle, action, children, className = '', pad = true }) => (
  <section className={cx('rounded-[24px] border border-slate-100 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)]', className)}>
    {(title || action) && (
      <header className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-poppins text-[17px] font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[13px] text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    <div className={pad ? 'p-6' : ''}>{children}</div>
  </section>
);

const Tabs = ({ value, onChange, items }) => (
  <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100/80 p-1">
    {items.map(([k, label, count]) => (
      <button key={k} onClick={() => onChange(k)} className={cx('flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-semibold transition', value === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
        {label}{count !== undefined && <span className={cx('rounded-full px-2 py-0.5 text-[12px]', value === k ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-500')}>{count}</span>}
      </button>
    ))}
  </div>
);

const Drawer = ({ open, title, subtitle, onClose, children, footer, wide }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/40 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" className={cx('flex h-full w-full flex-col bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-md')}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div><h2 className="font-poppins text-[19px] font-bold text-slate-900">{title}</h2>{subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex gap-2 border-t border-slate-100 px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  );
};

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[12px] text-slate-400">{hint}</span>}
  </label>
);
const inputCls = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100';
const Input = (p) => <input {...p} className={inputCls} />;
const Select = ({ options, ...p }) => <select {...p} className={inputCls}>{options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}</select>;
const TextArea = (p) => <textarea rows={3} {...p} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />;

const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative h-11 w-full shrink-0 sm:w-64">
    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[14px] outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
  </div>
);

const Chip = ({ tone = 'slate', children }) => {
  const t = { green: 'bg-emerald-50 text-emerald-700 ring-emerald-100', red: 'bg-red-50 text-red-700 ring-red-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100', indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100', slate: 'bg-slate-100 text-slate-600 ring-slate-200' }[tone];
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold ring-1', t)}>{children}</span>;
};

const Ring = ({ value, size = 120, stroke = 12, color = '#4F46E5', track = '#EEF2FF', label, sub }) => {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(value, 100)) / 100} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-poppins text-[22px] font-bold text-slate-900">{label ?? `${value}%`}</span>
        {sub && <span className="text-[12px] text-slate-500">{sub}</span>}
      </div>
    </div>
  );
};

const Bar = ({ value, tone = 'indigo' }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div className={cx('h-full rounded-full transition-all', tone === 'green' ? 'bg-emerald-500' : tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-600 to-violet-500')} style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

const Empty = ({ icon: Icon = Sparkles, title, text, action }) => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-14 text-center">
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200"><Icon className="h-7 w-7" /></span>
    <p className="font-poppins text-[17px] font-bold text-slate-800">{title}</p>
    {text && <p className="mt-1 max-w-md text-[14px] leading-6 text-slate-500">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const Avatar = ({ name = '?', size = 'h-10 w-10', className = '' }) => (
  <span className={cx('flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white', size, className)}>{(name || '?').trim().slice(0, 1).toUpperCase()}</span>
);

const DeviceNote = () => <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/90"><ShieldCheck className="h-3.5 w-3.5" />Saved on this device until the server module is connected</span>;

const StudentName = ({ student, id, name, sub, link = true }) => {
  const navigate = useNavigate();
  const sid = student?.id || id; const label = student?.name || name || sid;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={label} size="h-9 w-9" />
      <div className="min-w-0">
        {sid && link ? <button onClick={() => navigate(`/students/profile?id=${sid}`)} className="truncate text-left text-[14px] font-semibold text-slate-900 hover:text-indigo-700 hover:underline">{label}</button> : <span className="text-[14px] font-semibold">{label}</span>}
        {sub && <p className="truncate text-[13px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
};

const StudentPicker = ({ students, value, onChange }) => {
  const [q, setQ] = useState('');
  const list = (students || []).filter((s) => !q || `${s.name} ${s.admission_no} ${s.class_name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const chosen = (students || []).find((s) => s.id === value);
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Student</span>
      {chosen ? (
        <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
          <StudentName link={false} student={chosen} sub={`${classLabel(chosen)} · ${chosen.admission_no || chosen.id}`} />
          <button onClick={() => onChange('')} className="text-[13px] font-semibold text-indigo-700">Change</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200">
          <div className="border-b border-slate-100 p-2"><SearchBox value={q} onChange={setQ} placeholder={students ? 'Search by name or admission no' : 'Loading students…'} /></div>
          <div className="max-h-56 overflow-y-auto p-1">
            {list.length === 0 && <p className="p-4 text-center text-[13px] text-slate-500">{students ? 'No matching students' : 'Loading…'}</p>}
            {list.map((s) => (
              <button key={s.id} onClick={() => onChange(s.id)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-indigo-50">
                <StudentName link={false} student={s} sub={`${classLabel(s)} · ${s.admission_no || s.id}`} />
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ children, onClick }) => <div onClick={onClick} className={cx('flex flex-col gap-3 border-b border-slate-50 px-6 py-4 last:border-0 sm:flex-row sm:items-center', onClick && 'cursor-pointer hover:bg-indigo-50/40')}>{children}</div>;

/* =============================== COMPLIANCE ============================== */
export const Compliance = () => {
  const students = useStudents();
  const overrides = useLocalRecords('compliance_overrides', []);
  const [school, setSchool] = useState(() => { try { return JSON.parse(localStorage.getItem('orison_udise_school') || '{}'); } catch { return {}; } });
  const [tab, setTab] = useState('missing');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [setup, setSetup] = useState(false);
  useEffect(() => { try { localStorage.setItem('orison_udise_school', JSON.stringify(school)); } catch { /* ignore */ } }, [school]);
  const merged = useMemo(() => (students || []).map((s) => ({ ...s, ...(overrides.items.find((o) => o.id === s.id) || {}) })), [students, overrides.items]);
  const total = merged.length;
  const consentOk = (s) => /received|yes/i.test(s.aadhaar_consent || '');
  const stage = (s) => (s.apaar_id ? 3 : s.pen && consentOk(s) ? 2 : consentOk(s) ? 1 : 0);
  const counts = [0, 1, 2, 3].map((i) => merged.filter((s) => stage(s) === i).length);
  const withApaar = counts[3]; const withPen = merged.filter((s) => s.pen).length; const rte = merged.filter((s) => /yes/i.test(s.rte_quota || '')).length;
  const byClass = useMemo(() => {
    const m = {};
    merged.forEach((s) => { const k = s.class_name || 'Unassigned'; m[k] = m[k] || { total: 0, apaar: 0, pen: 0 }; m[k].total++; if (s.apaar_id) m[k].apaar++; if (s.pen) m[k].pen++; });
    return Object.entries(m).sort((a, b) => pct(a[1].apaar, a[1].total) - pct(b[1].apaar, b[1].total));
  }, [merged]);
  const rows = merged.filter((s) => (tab === 'missing' ? !s.apaar_id || !s.pen : tab === 'consent' ? !consentOk(s) : true) && (!q || `${s.name} ${s.admission_no} ${s.class_name}`.toLowerCase().includes(q.toLowerCase())));
  const save = async () => {
    const e = editing;
    if (e.apaar_id && !/^\d{12}$/.test(e.apaar_id)) { notify('APAAR ID must be 12 digits.', 'error'); return; }
    const patch = { id: e.id, apaar_id: e.apaar_id || '', pen: e.pen || '', aadhaar_consent: e.aadhaar_consent || '', rte_quota: e.rte_quota || '' };
    try { await api.put(`/students/${e.id}`, { ...((students || []).find((s) => s.id === e.id) || {}), ...patch }); notify('Student record updated.', 'success'); }
    catch { notify('Saved on this device. It will sync once the server accepts these fields.', 'info'); }
    overrides.setItems((l) => [patch, ...l.filter((o) => o.id !== e.id)]); setEditing(null);
  };
  const exportUdise = () => downloadCsv(`udise-plus-students-${school.udise_code || 'school'}.csv`, [
    { label: 'UDISE Code', value: () => school.udise_code || '' }, { label: 'Student Name', value: 'name' }, { label: 'Gender', value: 'gender' }, { label: 'Date of Birth', value: 'dob' },
    { label: 'Class', value: 'class_name' }, { label: 'Section', value: 'section' }, { label: 'Admission No', value: 'admission_no' }, { label: 'PEN', value: 'pen' }, { label: 'APAAR ID', value: 'apaar_id' },
    { label: 'APAAR Consent', value: 'aadhaar_consent' }, { label: 'Father Name', value: 'father_name' }, { label: 'Mother Name', value: 'mother_name' }, { label: 'Mobile', value: (s) => s.mobile || s.parent_phone },
    { label: 'Blood Group', value: 'blood_group' }, { label: 'RTE Quota', value: 'rte_quota' }, { label: 'Academic Year', value: 'academic_year' },
  ], merged);
  const stages = [
    { label: 'Consent pending', help: 'Ask parents to consent (Parent app › APAAR ID)', tone: 'amber' },
    { label: 'Consent received', help: 'Check details and get the PEN from UDISE+', tone: 'indigo' },
    { label: 'Ready to generate', help: 'Generate APAAR on the UDISE+ portal', tone: 'indigo' },
    { label: 'APAAR generated', help: 'Shown on ID cards, TCs and DigiLocker', tone: 'green' },
  ];
  return (
    <Layout>
      <Hero icon={Landmark} eyebrow="Government compliance" title="APAAR · PEN · UDISE+" tone="indigo"
        text="Track every student's national IDs. PEN comes from UDISE+; APAAR — the 12-digit “One Nation, One Student ID” — is generated from the PEN after parent consent and appears in DigiLocker."
        actions={<><HeroBtn icon={Landmark} onClick={() => setSetup(true)}>School UDISE+ details</HeroBtn><HeroBtn light icon={Download} onClick={exportUdise}>Export UDISE+ CSV</HeroBtn></>}
        stats={[
          { label: 'Students', value: total },
          { label: 'APAAR generated', value: `${pct(withApaar, total)}%` },
          { label: 'PEN available', value: `${pct(withPen, total)}%` },
          { label: 'RTE 25% quota', value: rte },
        ]} />

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="APAAR pipeline" subtitle="Where each student is in the 4-step process">
          <div className="grid gap-3 md:grid-cols-4">
            {stages.map((s, i) => (
              <div key={s.label} className="relative rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className={cx('flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold text-white', s.tone === 'green' ? 'bg-emerald-500' : s.tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-600')}>{i + 1}</span>
                  {i < 3 && <ChevronRight className="hidden h-4 w-4 text-slate-300 md:block" />}
                </div>
                <p className="font-poppins text-[26px] font-bold text-slate-900">{counts[i]}</p>
                <p className="text-[14px] font-semibold text-slate-800">{s.label}</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">{s.help}</p>
                <div className="mt-3"><Bar value={pct(counts[i], total)} tone={s.tone} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Coverage" subtitle="Share of students with each ID">
          <div className="flex flex-wrap items-center justify-around gap-6">
            <div className="text-center"><Ring value={pct(withApaar, total)} color="#4F46E5" /><p className="mt-2 text-[14px] font-semibold text-slate-700">APAAR ID</p></div>
            <div className="text-center"><Ring value={pct(withPen, total)} color="#0EA5E9" track="#E0F2FE" /><p className="mt-2 text-[14px] font-semibold text-slate-700">PEN</p></div>
            <div className="text-center"><Ring value={pct(merged.filter(consentOk).length, total)} color="#10B981" track="#D1FAE5" /><p className="mt-2 text-[14px] font-semibold text-slate-700">Consent</p></div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel pad={false} title="Students" subtitle="Click a student to update their IDs"
          action={<div className="flex flex-col gap-2 2xl:flex-row 2xl:items-center"><Tabs value={tab} onChange={setTab} items={[['missing', 'Missing IDs', merged.filter((s) => !s.apaar_id || !s.pen).length], ['consent', 'No consent', merged.filter((s) => !consentOk(s)).length], ['all', 'All', total]]} /><SearchBox value={q} onChange={setQ} placeholder="Search student" /></div>}>
          {students === null ? <p className="p-10 text-center text-[14px] text-slate-500">Loading students…</p> : rows.length === 0 ? <div className="p-6"><Empty icon={CheckCircle2} title="Nothing to fix here" text="All students in this view have their IDs." /></div> : rows.slice(0, 200).map((s) => (
            <Row key={s.id} onClick={() => setEditing({ ...s })}>
              <div className="min-w-0 flex-1"><StudentName link={false} student={s} sub={`${classLabel(s)} · Adm ${s.admission_no || '—'}`} /></div>
              <div className="flex flex-wrap items-center gap-2">
                {s.pen ? <Chip tone="indigo">PEN {s.pen}</Chip> : <Chip tone="red">No PEN</Chip>}
                {s.apaar_id ? <Chip tone="green"><Check className="h-3 w-3" />APAAR</Chip> : <Chip tone="amber">No APAAR</Chip>}
                <Chip tone={consentOk(s) ? 'green' : 'slate'}>{s.aadhaar_consent || 'Consent not asked'}</Chip>
                <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:block" />
              </div>
            </Row>
          ))}
        </Panel>
        <div className="space-y-6">
          <Panel title="Lowest coverage by class">
            {byClass.length === 0 ? <p className="text-[14px] text-slate-500">No classes yet.</p> : byClass.slice(0, 8).map(([cls, v]) => (
              <div key={cls} className="mb-4 last:mb-0">
                <div className="mb-1.5 flex justify-between text-[14px]"><span className="font-semibold text-slate-800">{cls}</span><span className="text-slate-500">{v.apaar}/{v.total} · {pct(v.apaar, v.total)}%</span></div>
                <Bar value={pct(v.apaar, v.total)} tone={pct(v.apaar, v.total) < 50 ? 'red' : pct(v.apaar, v.total) < 90 ? 'amber' : 'green'} />
              </div>
            ))}
          </Panel>
          <Panel title="How APAAR works">
            <ol className="space-y-3 text-[14px] text-slate-600">
              {['Parent gives consent (paper form or Parent app)', 'School checks name (as per Aadhaar), DOB, gender and parents\' names', 'UDISE+ portal generates the APAAR ID against the PEN', 'ID is pushed to the student\'s DigiLocker; record it here'].map((t, i) => (
                <li key={t} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[12px] font-bold text-indigo-700">{i + 1}</span>{t}</li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.name} subtitle={editing && `${classLabel(editing)} · Adm ${editing.admission_no || '—'}`}
        footer={<><Btn onClick={save} className="flex-1">Save</Btn><Btn variant="outline" onClick={() => setEditing(null)}>Cancel</Btn></>}>
        {editing && <>
          <Field label="PEN (from UDISE+)"><Input value={editing.pen || ''} onChange={(e) => setEditing({ ...editing, pen: e.target.value.trim() })} placeholder="Permanent Education Number" /></Field>
          <Field label="APAAR ID" hint="12 digits — from UDISE+ / DigiLocker"><Input value={editing.apaar_id || ''} onChange={(e) => setEditing({ ...editing, apaar_id: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="0000 0000 0000" /></Field>
          <Field label="Parent consent for APAAR"><Select value={editing.aadhaar_consent || ''} onChange={(e) => setEditing({ ...editing, aadhaar_consent: e.target.value })} options={[{ value: '', label: 'Not requested' }, 'Pending', 'Received', 'Declined']} /></Field>
          <Field label="RTE 25% quota"><Select value={editing.rte_quota || ''} onChange={(e) => setEditing({ ...editing, rte_quota: e.target.value })} options={[{ value: '', label: 'Not set' }, 'Yes', 'No']} /></Field>
          <div className="flex gap-2 rounded-2xl bg-indigo-50 p-4 text-[13px] leading-5 text-indigo-900"><Info className="mt-0.5 h-4 w-4 shrink-0" />The student's name must match Aadhaar exactly, or UDISE+ will reject APAAR generation.</div>
        </>}
      </Drawer>
      <Drawer open={setup} onClose={() => setSetup(false)} title="School UDISE+ details" footer={<Btn onClick={() => { setSetup(false); notify('UDISE+ details saved.', 'success'); }} className="flex-1">Done</Btn>}>
        <Field label="UDISE+ code" hint="11 digits, from the UDISE+ portal"><Input value={school.udise_code || ''} onChange={(e) => setSchool({ ...school, udise_code: e.target.value.replace(/\D/g, '').slice(0, 11) })} /></Field>
        <Field label="Board"><Select value={school.board || 'CBSE'} onChange={(e) => setSchool({ ...school, board: e.target.value })} options={['CBSE', 'ICSE', 'State Board (Telangana)', 'State Board (Andhra Pradesh)', 'IB', 'Cambridge']} /></Field>
        <Field label="APAAR coordinator"><Input value={school.coordinator || ''} onChange={(e) => setSchool({ ...school, coordinator: e.target.value })} /></Field>
      </Drawer>
    </Layout>
  );
};

/* ============================== CERTIFICATES ============================= */
const CERT_TYPES = [
  { type: 'Transfer Certificate', code: 'TC', icon: FileText, color: 'from-rose-500 to-pink-500', text: 'When a student leaves the school' },
  { type: 'Bonafide Certificate', code: 'BC', icon: ShieldCheck, color: 'from-indigo-500 to-violet-500', text: 'Proof the student studies here' },
  { type: 'Character Certificate', code: 'CC', icon: Award, color: 'from-amber-500 to-orange-500', text: 'Conduct during the stay' },
  { type: 'Study Certificate', code: 'SC', icon: BookOpen, color: 'from-sky-500 to-cyan-500', text: 'Years and class of study' },
  { type: 'Conduct Certificate', code: 'CD', icon: CheckCircle2, color: 'from-emerald-500 to-teal-500', text: 'Behaviour and discipline' },
];
const certificateBody = (type, s, f) => {
  const ward = `${s.gender === 'Female' ? 'daughter' : s.gender === 'Male' ? 'son' : 'ward'} of ${esc(s.father_name || s.parent_name || s.guardian_name || '—')}`;
  const who = `<b>${esc(s.name)}</b>, ${ward}, Admission No. <b>${esc(s.admission_no || s.id)}</b>`;
  if (type === 'Transfer Certificate') {
    const rows = [['Name of the student', s.name], ['Admission number', s.admission_no || s.id], ['APAAR ID', s.apaar_id || '—'], ['PEN (UDISE+)', s.pen || '—'], ['Father / Guardian name', s.father_name || s.guardian_name || '—'], ['Mother name', s.mother_name || '—'], ['Date of birth', s.dob || '—'], ['Class last studied', classLabel(s)], ['Academic year', s.academic_year || '—'], ['Date of leaving', fmtDate(f.leaving_date)], ['Reason for leaving', f.reason || '—'], ['Dues cleared', f.dues_cleared ? 'Yes' : 'No'], ['General conduct', f.conduct || 'Good'], ['Remarks', f.remarks || '—']];
    return `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows.map(([k, v], i) => `<tr><td style="border:1px solid #999;padding:8px;width:42%">${i + 1}. ${k}</td><td style="border:1px solid #999;padding:8px"><b>${esc(v)}</b></td></tr>`).join('')}</table>`;
  }
  const purpose = f.purpose ? ` This certificate is issued on request for the purpose of <b>${esc(f.purpose)}</b>.` : '';
  if (type === 'Bonafide Certificate') return `<p>This is to certify that ${who}, is a bonafide student of this school, studying in <b>${esc(classLabel(s))}</b> during the academic year <b>${esc(s.academic_year || '')}</b>. Date of birth as per school records: <b>${esc(s.dob || '—')}</b>.${purpose}</p>`;
  if (type === 'Study Certificate') return `<p>This is to certify that ${who}, has studied in this school and is presently in <b>${esc(classLabel(s))}</b> for the academic year <b>${esc(s.academic_year || '')}</b>.${purpose}</p>`;
  return `<p>This is to certify that ${who}, of <b>${esc(classLabel(s))}</b>, is known to us. During the period of study in this school, the student's conduct and character have been <b>${esc(f.conduct || 'Good')}</b>.${purpose}</p>`;
};
const certificateHtml = (rec, s) => `
  <div style="max-width:760px;margin:0 auto;border:3px double #3730a3;padding:36px 44px;min-height:960px;position:relative;background:#fff">
    <div style="text-align:center;border-bottom:2px solid #3730a3;padding-bottom:14px">
      <div class="sans" style="font-size:26px;font-weight:800;color:#3730a3">${esc(SCHOOL.name)}</div>
      <div class="sans" style="font-size:13px;color:#555">${esc(SCHOOL.campus)} · ${esc(SCHOOL.address)} · Affiliated to ${esc(SCHOOL.affiliation)}</div>
    </div>
    <div class="sans" style="display:flex;justify-content:space-between;font-size:13px;margin:16px 0 4px"><span>Serial No: <b>${esc(rec.serial)}</b></span><span>Date: <b>${fmtDate(rec.issued_on)}</b></span></div>
    <h1 style="text-align:center;font-size:24px;letter-spacing:2px;text-decoration:underline;margin:22px 0">${esc(rec.type.toUpperCase())}</h1>
    <div style="font-size:16px;line-height:1.9;text-align:justify">${certificateBody(rec.type, s, rec.fields)}</div>
    <div class="sans" style="position:absolute;left:44px;right:44px;bottom:48px;display:flex;justify-content:space-between;font-size:14px">
      <div style="text-align:center"><div style="width:170px;border-top:1px solid #333;margin-bottom:4px"></div>Class Teacher</div>
      <div style="text-align:center"><div style="width:110px;height:56px;border:1px dashed #aaa;margin:0 auto 6px;font-size:11px;color:#aaa;display:flex;align-items:center;justify-content:center">School seal</div></div>
      <div style="text-align:center"><div style="width:170px;border-top:1px solid #333;margin-bottom:4px"></div>Principal</div>
    </div>
  </div>`;
const printCertificate = (rec, s) => openPrintWindow(rec.serial, certificateHtml(rec, s) + '<p class="noprint sans" style="text-align:center;color:#888">Use your browser\'s print dialog to print or save as PDF.</p>');

export const Certificates = () => {
  const register = useLocalRecords('certificate_register', []);
  const students = useStudents();
  const [type, setType] = useState('Bonafide Certificate');
  const [studentId, setStudentId] = useState('');
  const [filter, setFilter] = useState('all');
  const [f, setF] = useState({ purpose: '', conduct: 'Good', leaving_date: today(), reason: 'Parent request', dues_cleared: true, remarks: '' });
  const student = (students || []).find((s) => s.id === studentId);
  const meta = CERT_TYPES.find((c) => c.type === type);
  const year = new Date().getFullYear();
  const nextSerial = `${meta.code}/${year}/${String(register.items.filter((r) => r.type === type && r.serial.includes(`/${year}/`)).length + 1).padStart(4, '0')}`;
  const issue = () => {
    if (!student) { notify('Choose a student first.', 'error'); return; }
    if (type === 'Transfer Certificate' && !f.dues_cleared) { notify('Fee and library dues must be cleared before a TC is issued.', 'error'); return; }
    const rec = { id: uid('CERT'), serial: nextSerial, type, student_id: student.id, student_name: student.name, class_label: classLabel(student), issued_on: today(), fields: { ...f } };
    register.add(rec); printCertificate(rec, student); notify(`${type} ${rec.serial} issued.`, 'success');
  };
  const rows = register.items.filter((r) => filter === 'all' || r.type === filter);
  const preview = student ? certificateHtml({ serial: nextSerial, type, issued_on: today(), fields: f }, student) : '';
  return (
    <Layout>
      <Hero icon={Award} eyebrow="Front office" title="Certificates" tone="rose"
        text="Issue TC, bonafide, character, study and conduct certificates with automatic serial numbers, a live preview and a permanent register."
        actions={<DeviceNote />}
        stats={[
          { label: 'Issued this year', value: register.items.filter((r) => r.serial.includes(`/${year}/`)).length },
          { label: 'Transfer certificates', value: register.items.filter((r) => r.type === 'Transfer Certificate').length },
          { label: 'Bonafide', value: register.items.filter((r) => r.type === 'Bonafide Certificate').length },
          { label: 'This month', value: register.items.filter((r) => r.issued_on.slice(0, 7) === today().slice(0, 7)).length },
        ]} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {CERT_TYPES.map((c) => { const Icon = c.icon; const on = c.type === type; return (
          <button key={c.type} onClick={() => setType(c.type)} className={cx('group rounded-2xl border bg-white p-4 text-left transition', on ? 'border-transparent ring-2 ring-indigo-500 shadow-lg shadow-indigo-100' : 'border-slate-100 hover:-translate-y-0.5 hover:shadow-md')}>
            <span className={cx('mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white', c.color)}><Icon className="h-5 w-5" /></span>
            <p className="text-[14px] font-bold text-slate-900">{c.type.replace(' Certificate', '')}</p>
            <p className="mt-0.5 text-[12px] leading-5 text-slate-500">{c.text}</p>
          </button>
        ); })}
      </div>
      <div className="mb-6 grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Panel title={`Issue ${type}`} subtitle={`Next serial · ${nextSerial}`}>
          <div className="space-y-4">
            <StudentPicker students={students} value={studentId} onChange={setStudentId} />
            {student && (!student.apaar_id || !student.pen) && <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800"><Info className="mt-0.5 h-4 w-4 shrink-0" />{!student.apaar_id ? 'APAAR ID' : 'PEN'} missing — update it in Compliance so it prints on the certificate.</div>}
            {type === 'Transfer Certificate' ? <>
              <Field label="Date of leaving"><Input type="date" value={f.leaving_date} onChange={(e) => setF({ ...f, leaving_date: e.target.value })} /></Field>
              <Field label="Reason for leaving"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-[14px] text-slate-700"><input type="checkbox" checked={f.dues_cleared} onChange={(e) => setF({ ...f, dues_cleared: e.target.checked })} className="h-4 w-4 accent-indigo-600" />Fee, library and transport dues cleared</label>
              <Field label="General conduct"><Select value={f.conduct} onChange={(e) => setF({ ...f, conduct: e.target.value })} options={['Excellent', 'Very good', 'Good', 'Satisfactory']} /></Field>
              <Field label="Remarks"><Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
            </> : <>
              <Field label="Purpose"><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="e.g. Passport application, scholarship" /></Field>
              {(type === 'Character Certificate' || type === 'Conduct Certificate') && <Field label="Conduct"><Select value={f.conduct} onChange={(e) => setF({ ...f, conduct: e.target.value })} options={['Excellent', 'Very good', 'Good', 'Satisfactory']} /></Field>}
            </>}
            <Btn icon={Printer} onClick={issue} className="w-full" disabled={!student}>Issue & print</Btn>
          </div>
        </Panel>
        <Panel title="Live preview" subtitle="Exactly what will print">
          {student ? (
            <div className="relative h-[560px] overflow-hidden rounded-2xl bg-slate-100 sm:h-[760px]">
              <div className="absolute left-1/2 top-5 w-[760px] origin-top -translate-x-1/2 scale-[0.42] sm:scale-[0.72] 2xl:scale-[0.8]" style={{ fontFamily: 'Georgia, serif' }} dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          ) : <Empty icon={FileText} title="Choose a student" text="The certificate preview appears here as you fill in the details." />}
        </Panel>
      </div>
      <Panel pad={false} title="Certificate register" subtitle="Every certificate issued, with its serial number"
        action={<div className="flex flex-col gap-2 sm:flex-row"><Select value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: 'all', label: 'All types' }, ...CERT_TYPES.map((c) => c.type)]} /><Btn variant="outline" icon={Download} onClick={() => downloadCsv('certificate-register.csv', [{ label: 'Serial', value: 'serial' }, { label: 'Type', value: 'type' }, { label: 'Student', value: 'student_name' }, { label: 'Class', value: 'class_label' }, { label: 'Issued on', value: 'issued_on' }], register.items)}>Export</Btn></div>}>
        {rows.length === 0 ? <div className="p-6"><Empty icon={Award} title="No certificates issued yet" text="Pick a type above, choose a student and issue your first certificate." /></div> : rows.map((r) => (
          <Row key={r.id}>
            <span className="w-36 shrink-0 font-mono text-[13px] font-semibold text-indigo-700">{r.serial}</span>
            <div className="min-w-0 flex-1"><StudentName id={r.student_id} name={r.student_name} sub={r.class_label} /></div>
            <Chip tone="indigo">{r.type}</Chip>
            <span className="w-28 text-[13px] text-slate-500">{fmtDate(r.issued_on)}</span>
            <Btn variant="outline" icon={Printer} onClick={() => printCertificate(r, (students || []).find((s) => s.id === r.student_id) || { name: r.student_name, id: r.student_id })}>Reprint</Btn>
          </Row>
        ))}
      </Panel>
    </Layout>
  );
};

/* ================================ ID CARDS =============================== */
const IdCardPreview = ({ s, year }) => (
  <div className="w-[216px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(79,70,229,0.16)]">
    <div className="bg-gradient-to-br from-[#1E1B4B] via-[#4338CA] to-[#7C3AED] px-3 pb-9 pt-3 text-white">
      <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[13px] font-extrabold text-indigo-700">O</span><div className="leading-tight"><p className="text-[12px] font-extrabold uppercase tracking-wide">{SCHOOL.name}</p><p className="text-[12px] text-white/75">{SCHOOL.campus} · {year}-{String(year + 1).slice(2)}</p></div></div>
    </div>
    <div className="-mt-7 flex justify-center"><span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-indigo-50 text-[24px] font-bold text-indigo-600">{s.avatar ? <img src={s.avatar} alt="" className="h-full w-full object-cover" /> : (s.name || '?')[0]}</span></div>
    <div className="px-3 pb-3 pt-1 text-center">
      <p className="truncate text-[15px] font-bold text-slate-900">{s.name}</p>
      <p className="text-[12px] font-semibold text-indigo-600">{classLabel(s)}</p>
      <dl className="mt-2 space-y-0.5 text-left text-[12px]">
        {[['Adm no', s.admission_no || s.id], ['APAAR', s.apaar_id || '—'], ['Blood', s.blood_group || '—'], ['Parent', s.mobile || s.parent_phone || '—']].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2"><dt className="text-slate-400">{k}</dt><dd className={cx('truncate font-semibold', v === '—' ? 'text-amber-600' : 'text-slate-700')}>{v}</dd></div>
        ))}
      </dl>
    </div>
  </div>
);

export const IdCards = () => {
  const students = useStudents();
  const [cls, setCls] = useState('');
  const [selected, setSelected] = useState({});
  const classes = useMemo(() => [...new Set((students || []).map(classLabel).filter(Boolean))].sort(), [students]);
  const list = (students || []).filter((s) => !cls || classLabel(s) === cls);
  const chosen = list.filter((s) => selected[s.id] ?? true);
  const missing = list.filter((s) => !s.apaar_id || !s.blood_group).length;
  const year = new Date().getFullYear();
  const setAll = (v) => setSelected(Object.fromEntries(list.map((s) => [s.id, v])));
  const print = () => {
    if (!chosen.length) { notify('Select at least one student.', 'error'); return; }
    openPrintWindow('Student ID cards', `<div class="grid">${chosen.map((s) => `
      <div class="card sans"><div class="top"><div class="logo">O</div><div><div class="sn">${esc(SCHOOL.name)}</div><div class="sub">${esc(SCHOOL.campus)} · ${year}-${String(year + 1).slice(2)}</div></div></div>
      <div class="body"><div class="photo">${s.avatar ? `<img src="${esc(s.avatar)}"/>` : esc((s.name || '?').slice(0, 1))}</div><div class="nm">${esc(s.name)}</div><div class="cl">${esc(classLabel(s))}</div>
      <table><tr><td>Adm No</td><td>${esc(s.admission_no || s.id)}</td></tr><tr><td>APAAR</td><td>${esc(s.apaar_id || '—')}</td></tr><tr><td>Blood</td><td>${esc(s.blood_group || '—')}</td></tr><tr><td>Parent</td><td>${esc(s.mobile || s.parent_phone || '—')}</td></tr><tr><td>Bus</td><td>${esc(s.transport_route || 'Own transport')}</td></tr></table></div>
      <div class="foot">If found, please return to the school office</div></div>`).join('')}</div>`,
    `.grid{display:grid;grid-template-columns:repeat(3,54mm);gap:6mm;justify-content:center}.card{width:54mm;height:86mm;border-radius:3mm;overflow:hidden;border:1px solid #c7c9d9;display:flex;flex-direction:column;page-break-inside:avoid}.top{background:linear-gradient(135deg,#1e1b4b,#4338ca,#7c3aed);color:#fff;display:flex;gap:2mm;align-items:center;padding:2.5mm}.logo{width:7mm;height:7mm;border-radius:2mm;background:#fff;color:#4338ca;font-weight:800;display:flex;align-items:center;justify-content:center}.sn{font-size:7.5pt;font-weight:800;line-height:1.1}.sub{font-size:6pt;opacity:.8}.body{flex:1;text-align:center;padding:2mm 3mm}.photo{width:20mm;height:24mm;margin:1mm auto;border-radius:2mm;background:#eef;display:flex;align-items:center;justify-content:center;font-size:18pt;color:#4338ca;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover}.nm{font-size:9pt;font-weight:800;margin-top:1mm}.cl{font-size:7pt;color:#4338ca;font-weight:700}table{width:100%;font-size:6.5pt;margin-top:1.5mm;text-align:left}td:first-child{color:#666;width:40%}.foot{background:#f1f1f7;font-size:5.5pt;text-align:center;padding:1.2mm;color:#555}`);
  };
  return (
    <Layout>
      <Hero icon={Fingerprint} eyebrow="Front office" title="Student ID cards" tone="violet"
        text="Print standard CR-80 ID cards with photo, admission number, APAAR ID, blood group, parent contact and bus route. Parents also see a digital copy in the Parent app."
        actions={<HeroBtn light icon={Printer} onClick={print}>Print {chosen.length} card{chosen.length === 1 ? '' : 's'}</HeroBtn>}
        stats={[{ label: 'Students', value: list.length }, { label: 'Selected', value: chosen.length }, { label: 'Missing APAAR / blood group', value: missing }, { label: 'Classes', value: classes.length }]} />
      <Panel title="Preview" subtitle="Click a card to include or skip it"
        action={<div className="flex flex-col gap-2 sm:flex-row"><Select value={cls} onChange={(e) => setCls(e.target.value)} options={[{ value: '', label: 'All classes' }, ...classes]} /><Btn variant="outline" onClick={() => setAll(true)}>Select all</Btn><Btn variant="ghost" onClick={() => setAll(false)}>Clear</Btn></div>}>
        {students === null ? <p className="py-10 text-center text-[14px] text-slate-500">Loading students…</p> : list.length === 0 ? <Empty icon={Users} title="No students found" /> : (
          <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
            {list.slice(0, 60).map((s) => { const on = selected[s.id] ?? true; return (
              <button key={s.id} onClick={() => setSelected({ ...selected, [s.id]: !on })} className={cx('relative rounded-3xl p-1 transition', on ? 'ring-2 ring-indigo-500' : 'opacity-40 grayscale hover:opacity-70')}>
                {on && <span className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow"><Check className="h-4 w-4" /></span>}
                <IdCardPreview s={s} year={year} />
              </button>
            ); })}
          </div>
        )}
        {list.length > 60 && <p className="mt-4 text-center text-[13px] text-slate-500">Showing 60 of {list.length} — all selected cards will print.</p>}
      </Panel>
    </Layout>
  );
};

/* ============================== CONSENT FORMS ============================ */
export const ConsentForms = () => {
  const campaigns = useLocalRecords('consent_campaigns', []);
  const students = useStudents();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState('');
  const [view, setView] = useState('pending');
  const [f, setF] = useState({ title: '', details: '', scope: '', due_on: '' });
  const classes = useMemo(() => [...new Set((students || []).map(classLabel).filter(Boolean))].sort(), [students]);
  const inScope = (c) => (students || []).filter((s) => !c.scope || classLabel(s) === c.scope);
  const stats = (c) => { const sc = inScope(c); const agreed = sc.filter((s) => c.responses[s.id] === 'Agreed').length; const declined = sc.filter((s) => c.responses[s.id] === 'Declined').length; return { total: sc.length, agreed, declined, pending: sc.length - agreed - declined }; };
  const create = () => {
    if (!f.title.trim() || !f.due_on) { notify('Enter a title and a reply-by date.', 'error'); return; }
    const c = { ...f, id: uid('CNS'), created_on: today(), responses: {} };
    campaigns.add(c); setCreating(false); setOpenId(c.id); setF({ title: '', details: '', scope: '', due_on: '' });
    notify('Consent form sent. Parents see it in the Parent app.', 'success');
  };
  const open = campaigns.items.find((c) => c.id === openId);
  const remind = (c) => { navigator.clipboard?.writeText(`Dear Parent, please submit the consent form "${c.title}" in the Orison Parent app by ${fmtDate(c.due_on)}. Thank you.`); notify(`Reminder copied for ${stats(c).pending} pending parent(s) — paste it in WhatsApp or Send Notification.`, 'success'); };
  const all = campaigns.items.reduce((a, c) => { const s = stats(c); return { total: a.total + s.total, agreed: a.agreed + s.agreed, pending: a.pending + s.pending }; }, { total: 0, agreed: 0, pending: 0 });
  return (
    <Layout>
      <Hero icon={ListChecks} eyebrow="Parent permissions" title="Consent forms" tone="teal"
        text="Collect parent consent for trips, events, photos and medical checks — online through the Parent app, or record paper replies here."
        actions={<><DeviceNote /><HeroBtn light icon={Plus} onClick={() => setCreating(true)}>New consent form</HeroBtn></>}
        stats={[{ label: 'Active forms', value: campaigns.items.filter((c) => c.due_on >= today()).length }, { label: 'Replies received', value: `${pct(all.total - all.pending, all.total)}%` }, { label: 'Agreed', value: all.agreed }, { label: 'Waiting for reply', value: all.pending }]} />
      {campaigns.items.length === 0 ? <Empty icon={ListChecks} title="No consent forms yet" text="Create your first form — for example a field trip — and send it to a class." action={<Btn icon={Plus} onClick={() => setCreating(true)}>New consent form</Btn>} /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.items.map((c) => { const s = stats(c); const p = pct(s.agreed + s.declined, s.total); const overdue = c.due_on < today(); return (
            <button key={c.id} onClick={() => { setOpenId(c.id); setView('pending'); }} className="rounded-[24px] border border-slate-100 bg-white p-5 text-left shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-poppins text-[17px] font-bold text-slate-900">{c.title}</p><p className="mt-1 text-[13px] text-slate-500">{c.scope || 'Whole school'} · reply by {fmtDate(c.due_on)}</p></div>
                <Chip tone={overdue ? 'red' : p === 100 ? 'green' : 'indigo'}>{overdue ? 'Closed' : p === 100 ? 'Complete' : 'Open'}</Chip>
              </div>
              <div className="mt-5 flex items-center gap-5">
                <Ring value={p} size={92} stroke={10} color="#0D9488" track="#CCFBF1" />
                <div className="space-y-1.5 text-[14px]">
                  <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{s.agreed} agreed</p>
                  <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />{s.declined} declined</p>
                  <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />{s.pending} waiting</p>
                </div>
              </div>
            </button>
          ); })}
        </div>
      )}
      <Drawer open={creating} onClose={() => setCreating(false)} title="New consent form" subtitle="Parents get it in the app and can agree or decline"
        footer={<><Btn icon={ListChecks} onClick={create} className="flex-1">Send to parents</Btn><Btn variant="outline" onClick={() => setCreating(false)}>Cancel</Btn></>}>
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Science centre field trip" /></Field>
        <Field label="Details for parents"><TextArea value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder="Date, place, cost, what to bring…" /></Field>
        <Field label="Send to"><Select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} options={[{ value: '', label: 'Whole school' }, ...classes]} /></Field>
        <Field label="Reply by"><Input type="date" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} /></Field>
        {f.title && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">Parent app preview</p><p className="font-semibold text-slate-900">{f.title}</p><p className="mt-1 text-[13px] text-slate-600">{f.details || 'Details will appear here.'}</p><div className="mt-3 flex gap-2"><span className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white">I agree</span><span className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-semibold text-slate-600">Decline</span></div></div>}
      </Drawer>
      <Drawer wide open={!!open} onClose={() => setOpenId('')} title={open?.title} subtitle={open && `${open.scope || 'Whole school'} · reply by ${fmtDate(open.due_on)}`}
        footer={open && <><Btn variant="outline" icon={MessageCircle} onClick={() => remind(open)}>Remind waiting parents</Btn><Btn variant="outline" icon={Download} onClick={() => downloadCsv('consent-responses.csv', [{ label: 'Student', value: 'name' }, { label: 'Class', value: classLabel }, { label: 'Response', value: (s) => open.responses[s.id] || 'Pending' }], inScope(open))}>Export</Btn><Btn variant="danger" icon={Trash2} onClick={async () => { if (await askConfirm(`Delete the consent form “${open.title}”?`)) { campaigns.remove(open.id); setOpenId(''); } }}>Delete</Btn></>}>
        {open && <>
          <Tabs value={view} onChange={setView} items={[['pending', 'Waiting', stats(open).pending], ['Agreed', 'Agreed', stats(open).agreed], ['Declined', 'Declined', stats(open).declined]]} />
          <div className="divide-y divide-slate-50 rounded-2xl border border-slate-100">
            {inScope(open).filter((s) => (view === 'pending' ? !open.responses[s.id] : open.responses[s.id] === view)).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <StudentName student={s} sub={classLabel(s)} />
                <div className="flex gap-1">{['Agreed', 'Declined'].map((v) => <button key={v} onClick={() => campaigns.update(open.id, (x) => ({ responses: { ...x.responses, [s.id]: v } }))} className={cx('rounded-lg px-3 py-1.5 text-[13px] font-semibold', open.responses[s.id] === v ? (v === 'Agreed' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{v}</button>)}</div>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-slate-500">Use the buttons to record paper replies. Online replies from the Parent app appear automatically once connected.</p>
        </>}
      </Drawer>
    </Layout>
  );
};

/* ================================ LIBRARY ================================ */
const BOOK_SEED = [
  { id: 'BK-1', title: 'Wings of Fire', author: 'A. P. J. Abdul Kalam', isbn: '9788173711466', category: 'Biography', copies: 4, shelf: 'B-2' },
  { id: 'BK-2', title: 'Malgudi Days', author: 'R. K. Narayan', isbn: '9780143039655', category: 'Fiction', copies: 3, shelf: 'F-1' },
  { id: 'BK-3', title: 'NCERT Mathematics Class 10', author: 'NCERT', isbn: '9788174506351', category: 'Textbook', copies: 10, shelf: 'T-4' },
];
const FINE_PER_DAY = 2;
const SPINES = ['from-indigo-600 to-violet-500', 'from-rose-500 to-orange-400', 'from-emerald-600 to-teal-400', 'from-sky-600 to-cyan-400', 'from-amber-500 to-yellow-400', 'from-fuchsia-600 to-pink-400'];

const LibraryWorkspace = ({ initialTab }) => {
  const books = useLocalRecords('library_books', BOOK_SEED);
  const issues = useLocalRecords('library_issues', []);
  const students = useStudents();
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState('');
  const [book, setBook] = useState({ title: '', author: '', isbn: '', category: 'Fiction', copies: 1, shelf: '' });
  const [loan, setLoan] = useState({ student_id: '', book_id: '', days: 14 });
  const out = (id) => issues.items.filter((i) => i.book_id === id && !i.returned_on).length;
  const fine = (i) => Math.max(0, daysBetween(i.due_on, i.returned_on || today())) * FINE_PER_DAY;
  const open = issues.items.filter((i) => !i.returned_on); const overdue = open.filter((i) => i.due_on < today());
  const copies = books.items.reduce((n, b) => n + Number(b.copies || 0), 0);
  const addBook = () => { if (!book.title.trim()) { notify('Enter the book title.', 'error'); return; } books.add({ ...book, id: uid('BK'), copies: Number(book.copies) || 1 }); setBook({ title: '', author: '', isbn: '', category: book.category, copies: 1, shelf: '' }); setDrawer(''); notify('Book added to the catalogue.', 'success'); };
  const issueBook = () => {
    const b = books.items.find((x) => x.id === loan.book_id); const s = (students || []).find((x) => x.id === loan.student_id);
    if (!b || !s) { notify('Choose a student and a book.', 'error'); return; }
    if (Number(b.copies) - out(b.id) <= 0) { notify('No copies of this book are available.', 'error'); return; }
    const due = new Date(); due.setDate(due.getDate() + Number(loan.days || 14));
    issues.add({ id: uid('ISS'), book_id: b.id, book_title: b.title, student_id: s.id, student_name: s.name, class_label: classLabel(s), issued_on: today(), due_on: due.toISOString().slice(0, 10), returned_on: '' });
    setLoan({ student_id: '', book_id: '', days: 14 }); setDrawer(''); notify(`${b.title} issued to ${s.name}.`, 'success');
  };
  const loans = tab === 'loans' ? open : tab === 'overdue' ? overdue : issues.items.filter((i) => i.returned_on);
  const catalogue = books.items.filter((b) => !q || `${b.title} ${b.author} ${b.isbn} ${b.category}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Layout>
      <Hero icon={Library} eyebrow="Library" title="School library" tone="sky"
        text={`Catalogue every title, issue books to students in two clicks and let the system track due dates and late fines (₹${FINE_PER_DAY}/day). Parents see their child's books in the app.`}
        actions={<><HeroBtn icon={Plus} onClick={() => setDrawer('book')}>Add book</HeroBtn><HeroBtn light icon={BookOpen} onClick={() => setDrawer('issue')}>Issue a book</HeroBtn></>}
        stats={[{ label: 'Titles', value: books.items.length }, { label: 'Copies', value: copies }, { label: 'On loan', value: open.length }, { label: `Overdue · ₹${overdue.reduce((n, i) => n + fine(i), 0)} fines`, value: overdue.length }]} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} items={[['catalogue', 'Catalogue', books.items.length], ['loans', 'On loan', open.length], ['overdue', 'Overdue', overdue.length], ['returned', 'Returned', issues.items.length - open.length]]} />
        {tab === 'catalogue' && <SearchBox value={q} onChange={setQ} placeholder="Search title, author, ISBN" />}
      </div>
      {tab === 'catalogue' ? (catalogue.length === 0 ? <Empty icon={Library} title="No books found" action={<Btn icon={Plus} onClick={() => setDrawer('book')}>Add book</Btn>} /> : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {catalogue.map((b, i) => { const avail = Number(b.copies) - out(b.id); return (
            <div key={b.id} className="group relative flex gap-4 rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:shadow-lg">
              <div className={cx('flex h-28 w-20 shrink-0 flex-col justify-between rounded-lg bg-gradient-to-br p-2 text-white shadow-md', SPINES[i % SPINES.length])}><BookOpen className="h-4 w-4 opacity-80" /><p className="line-clamp-3 text-[12px] font-bold leading-tight">{b.title}</p></div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 pr-6 text-[15px] font-bold leading-snug text-slate-900">{b.title}</p>
                <p className="truncate text-[13px] text-slate-500">{b.author}</p>
                <div className="mt-2 flex flex-wrap gap-1.5"><Chip>{b.category}</Chip>{b.shelf && <Chip><MapPin className="h-3 w-3" />{b.shelf}</Chip>}</div>
                <div className="mt-auto pt-3"><div className="mb-1 flex justify-between text-[12px]"><span className={avail > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>{avail > 0 ? `${avail} available` : 'All issued'}</span><span className="text-slate-400">{b.copies} copies</span></div><Bar value={pct(avail, b.copies)} tone={avail > 0 ? 'green' : 'red'} /></div>
              </div>
              <button aria-label={`Remove ${b.title}`} onClick={async () => { if (out(b.id)) { notify('Return all issued copies before removing this title.', 'error'); return; } if (await askConfirm(`Remove “${b.title}” from the catalogue?`)) books.remove(b.id); }} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
            </div>
          ); })}
        </div>
      )) : (
        <Panel pad={false}>
          {loans.length === 0 ? <div className="p-6"><Empty icon={BookOpen} title={tab === 'overdue' ? 'No overdue books' : tab === 'returned' ? 'No returns yet' : 'No books on loan'} action={tab !== 'returned' && <Btn icon={BookOpen} onClick={() => setDrawer('issue')}>Issue a book</Btn>} /></div> : loans.map((i) => { const late = !i.returned_on && i.due_on < today(); const total = Math.max(1, daysBetween(i.issued_on, i.due_on)); return (
            <Row key={i.id}>
              <div className="min-w-0 flex-1"><StudentName id={i.student_id} name={i.student_name} sub={i.class_label} /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-slate-800">{i.book_title}</p><div className="mt-1.5 max-w-[220px]"><Bar value={pct(daysBetween(i.issued_on, i.returned_on || today()), total)} tone={late ? 'red' : 'indigo'} /></div></div>
              <div className="w-40 text-[13px]">{i.returned_on ? <span className="text-slate-500">Returned {fmtDate(i.returned_on)}</span> : <span className={late ? 'font-semibold text-red-600' : 'text-slate-600'}>{late ? `${daysBetween(i.due_on, today())} days late · ₹${fine(i)}` : `Due ${fmtDate(i.due_on)}`}</span>}</div>
              {!i.returned_on && <Btn variant="outline" icon={Undo2} onClick={() => { issues.update(i.id, { returned_on: today() }); notify(`Return recorded${fine(i) ? ` · collect fine ₹${fine(i)}` : ''}.`, 'success'); }}>Return</Btn>}
            </Row>
          ); })}
        </Panel>
      )}
      <Drawer open={drawer === 'book'} onClose={() => setDrawer('')} title="Add a book" footer={<><Btn icon={Plus} onClick={addBook} className="flex-1">Add to catalogue</Btn><Btn variant="outline" onClick={() => setDrawer('')}>Cancel</Btn></>}>
        <Field label="Title"><Input value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} /></Field>
        <Field label="Author"><Input value={book.author} onChange={(e) => setBook({ ...book, author: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="ISBN"><Input value={book.isbn} onChange={(e) => setBook({ ...book, isbn: e.target.value })} /></Field><Field label="Shelf"><Input value={book.shelf} onChange={(e) => setBook({ ...book, shelf: e.target.value })} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Category"><Select value={book.category} onChange={(e) => setBook({ ...book, category: e.target.value })} options={['Fiction', 'Non-fiction', 'Textbook', 'Reference', 'Biography', 'Regional language', 'Magazine']} /></Field><Field label="Copies"><Input type="number" min="1" value={book.copies} onChange={(e) => setBook({ ...book, copies: e.target.value })} /></Field></div>
      </Drawer>
      <Drawer open={drawer === 'issue'} onClose={() => setDrawer('')} title="Issue a book" footer={<><Btn icon={BookOpen} onClick={issueBook} className="flex-1">Issue book</Btn><Btn variant="outline" onClick={() => setDrawer('')}>Cancel</Btn></>}>
        <StudentPicker students={students} value={loan.student_id} onChange={(v) => setLoan({ ...loan, student_id: v })} />
        <Field label="Book"><Select value={loan.book_id} onChange={(e) => setLoan({ ...loan, book_id: e.target.value })} options={[{ value: '', label: 'Select a book' }, ...books.items.map((b) => ({ value: b.id, label: `${b.title} (${Number(b.copies) - out(b.id)} available)` }))]} /></Field>
        <Field label="Loan period"><div className="grid grid-cols-3 gap-2">{[7, 14, 21].map((d) => <button key={d} onClick={() => setLoan({ ...loan, days: d })} className={cx('h-11 rounded-xl border text-[14px] font-semibold', Number(loan.days) === d ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600')}>{d} days</button>)}</div></Field>
      </Drawer>
    </Layout>
  );
};
export const LibraryCatalogue = () => <LibraryWorkspace initialTab="catalogue" />;
export const LibraryIssues = () => <LibraryWorkspace initialTab="loans" />;

/* ================================= HOSTEL ================================ */
const ROOM_SEED = [
  { id: 'RM-1', block: 'Boys Block A', room: 'A-101', capacity: 4, warden: 'Mr. Suresh Reddy' },
  { id: 'RM-2', block: 'Girls Block B', room: 'B-201', capacity: 3, warden: 'Mrs. Lakshmi Iyer' },
];
export const Hostel = () => {
  const rooms = useLocalRecords('hostel_rooms', ROOM_SEED);
  const beds = useLocalRecords('hostel_allocations', []);
  const students = useStudents();
  const [blockFilter, setBlockFilter] = useState('');
  const [roomId, setRoomId] = useState('');
  const [adding, setAdding] = useState(false);
  const [room, setRoom] = useState({ block: '', room: '', capacity: 4, warden: '' });
  const [pick, setPick] = useState('');
  const occupants = (id) => beds.items.filter((b) => b.room_id === id && !b.vacated_on);
  const capacity = rooms.items.reduce((n, r) => n + Number(r.capacity || 0), 0);
  const occupied = beds.items.filter((b) => !b.vacated_on).length;
  const blocks = [...new Set(rooms.items.map((r) => r.block))];
  const current = rooms.items.find((r) => r.id === roomId);
  const allocate = () => {
    const s = (students || []).find((x) => x.id === pick);
    if (!current || !s) { notify('Choose a student.', 'error'); return; }
    if (beds.items.some((b) => b.student_id === s.id && !b.vacated_on)) { notify(`${s.name} already has a hostel bed.`, 'error'); return; }
    if (occupants(current.id).length >= Number(current.capacity)) { notify(`${current.room} is full.`, 'error'); return; }
    beds.add({ id: uid('BED'), room_id: current.id, room_label: `${current.block} · ${current.room}`, student_id: s.id, student_name: s.name, class_label: classLabel(s), from: today(), vacated_on: '' });
    setPick(''); notify(`${s.name} allocated to ${current.room}.`, 'success');
  };
  return (
    <Layout>
      <Hero icon={BedDouble} eyebrow="Residential" title="Hostel" tone="rose"
        text="See every room and bed at a glance, allocate students, and keep wardens and parents in sync. Parents see room details and request outpasses in the app."
        actions={<><DeviceNote /><HeroBtn light icon={Plus} onClick={() => setAdding(true)}>Add room</HeroBtn></>}
        stats={[{ label: 'Rooms', value: rooms.items.length }, { label: 'Beds', value: capacity }, { label: 'Occupied', value: occupied }, { label: 'Occupancy', value: `${pct(occupied, capacity)}%` }]} />
      <div className="mb-5 flex flex-wrap gap-2">
        {['', ...blocks].map((b) => <button key={b || 'all'} onClick={() => setBlockFilter(b)} className={cx('rounded-full px-4 py-2 text-[14px] font-semibold', blockFilter === b ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>{b || 'All blocks'}</button>)}
      </div>
      {rooms.items.length === 0 ? <Empty icon={BedDouble} title="No rooms yet" action={<Btn icon={Plus} onClick={() => setAdding(true)}>Add room</Btn>} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.items.filter((r) => !blockFilter || r.block === blockFilter).map((r) => { const occ = occupants(r.id); const full = occ.length >= r.capacity; return (
            <button key={r.id} onClick={() => setRoomId(r.id)} className="rounded-[22px] border border-slate-100 bg-white p-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-start justify-between"><div><p className="font-poppins text-[20px] font-bold text-slate-900">{r.room}</p><p className="text-[13px] text-slate-500">{r.block}</p></div><Chip tone={full ? 'red' : occ.length ? 'indigo' : 'green'}>{full ? 'Full' : `${r.capacity - occ.length} free`}</Chip></div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {Array.from({ length: Number(r.capacity) }).map((_, i) => { const o = occ[i]; return (
                  <div key={i} title={o ? o.student_name : 'Empty bed'} className={cx('flex h-12 flex-col items-center justify-center rounded-xl text-[12px] font-bold', o ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white' : 'border-2 border-dashed border-slate-200 text-slate-300')}>
                    <BedDouble className="h-4 w-4" />{o ? o.student_name.split(' ')[0].slice(0, 7) : i + 1}
                  </div>
                ); })}
              </div>
              <p className="mt-4 text-[13px] text-slate-500">Warden · {r.warden || '—'}</p>
            </button>
          ); })}
        </div>
      )}
      <Drawer open={!!current} onClose={() => setRoomId('')} title={current && `${current.room} · ${current.block}`} subtitle={current && `${occupants(current.id).length} of ${current.capacity} beds used · Warden ${current.warden || '—'}`}
        footer={current && occupants(current.id).length < current.capacity && <Btn icon={BedDouble} onClick={allocate} className="flex-1" disabled={!pick}>Allocate bed</Btn>}>
        {current && <>
          <div className="space-y-2">
            {occupants(current.id).length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-[14px] text-slate-500">No students in this room yet.</p>}
            {occupants(current.id).map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-3">
                <StudentName id={b.student_id} name={b.student_name} sub={`${b.class_label} · since ${fmtDate(b.from)}`} />
                <Btn variant="danger" onClick={async () => { if (await askConfirm(`Vacate ${b.student_name} from ${current.room}?`)) beds.update(b.id, { vacated_on: today() }); }}>Vacate</Btn>
              </div>
            ))}
          </div>
          {occupants(current.id).length < current.capacity && <div className="border-t border-slate-100 pt-4"><p className="mb-3 text-[14px] font-semibold text-slate-800">Allocate a student</p><StudentPicker students={students} value={pick} onChange={setPick} /></div>}
        </>}
      </Drawer>
      <Drawer open={adding} onClose={() => setAdding(false)} title="Add a room" footer={<><Btn icon={Plus} className="flex-1" onClick={() => { if (!room.block || !room.room) { notify('Enter the block and room number.', 'error'); return; } rooms.add({ ...room, id: uid('RM'), capacity: Number(room.capacity) || 1 }); setRoom({ ...room, room: '' }); setAdding(false); notify('Room added.', 'success'); }}>Add room</Btn><Btn variant="outline" onClick={() => setAdding(false)}>Cancel</Btn></>}>
        <Field label="Block"><Input value={room.block} onChange={(e) => setRoom({ ...room, block: e.target.value })} placeholder="e.g. Boys Block A" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Room no"><Input value={room.room} onChange={(e) => setRoom({ ...room, room: e.target.value })} /></Field><Field label="Beds"><Input type="number" min="1" max="12" value={room.capacity} onChange={(e) => setRoom({ ...room, capacity: e.target.value })} /></Field></div>
        <Field label="Warden"><Input value={room.warden} onChange={(e) => setRoom({ ...room, warden: e.target.value })} /></Field>
      </Drawer>
    </Layout>
  );
};

/* ============================ EVENTS & GALLERY =========================== */
const COVERS = ['from-indigo-600 via-violet-600 to-fuchsia-500', 'from-amber-500 via-orange-500 to-rose-500', 'from-emerald-600 via-teal-500 to-cyan-400', 'from-sky-600 via-blue-600 to-indigo-600'];
export const EventsGallery = () => {
  const events = useLocalRecords('school_events', []);
  const [view, setView] = useState('upcoming');
  const [creating, setCreating] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [f, setF] = useState({ title: '', date: '', venue: '', audience: 'Parents & students', description: '', photos: [] });
  const readPhotos = (files) => Array.from(files || []).slice(0, 6).forEach((file) => {
    if (file.size > 450 * 1024) { notify(`${file.name} is larger than 450 KB — compress it first.`, 'error'); return; }
    const r = new FileReader(); r.onload = () => setF((x) => ({ ...x, photos: [...x.photos, r.result] })); r.readAsDataURL(file);
  });
  const save = () => { if (!f.title.trim() || !f.date) { notify('Enter the event name and date.', 'error'); return; } events.add({ ...f, id: uid('EVT') }); setF({ title: '', date: '', venue: '', audience: f.audience, description: '', photos: [] }); setCreating(false); notify('Event published to the calendar and Parent app.', 'success'); };
  const upcoming = events.items.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.items.filter((e) => e.date < today()).sort((a, b) => b.date.localeCompare(a.date));
  const photos = events.items.flatMap((e) => (e.photos || []).map((src, i) => ({ src, key: `${e.id}-${i}`, title: e.title })));
  const list = view === 'upcoming' ? upcoming : past;
  return (
    <Layout>
      <Hero icon={Images} eyebrow="Community" title="Events & gallery" tone="amber"
        text="Plan school events, publish them to parents' calendars, and keep a photo gallery of every celebration that parents can browse in the app."
        actions={<><DeviceNote /><HeroBtn light icon={Plus} onClick={() => setCreating(true)}>New event</HeroBtn></>}
        stats={[{ label: 'Upcoming', value: upcoming.length }, { label: 'Next event', value: upcoming[0] ? `${daysBetween(today(), upcoming[0].date)}d` : '—' }, { label: 'Past events', value: past.length }, { label: 'Photos', value: photos.length }]} />
      <div className="mb-5"><Tabs value={view} onChange={setView} items={[['upcoming', 'Upcoming', upcoming.length], ['past', 'Past', past.length], ['gallery', 'Gallery', photos.length]]} /></div>
      {view === 'gallery' ? (photos.length === 0 ? <Empty icon={Images} title="No photos yet" text="Add photos when you create an event. Parents see them in the app gallery." /> : (
        <div className="columns-2 gap-4 sm:columns-3 xl:columns-4">
          {photos.map((p) => <button key={p.key} onClick={() => setLightbox(p)} className="mb-4 block w-full overflow-hidden rounded-2xl shadow-md transition hover:shadow-xl"><img src={p.src} alt={p.title} className="w-full transition duration-500 hover:scale-105" /><p className="bg-white px-3 py-2 text-left text-[13px] font-semibold text-slate-700">{p.title}</p></button>)}
        </div>
      )) : list.length === 0 ? <Empty icon={CalendarDays} title={view === 'upcoming' ? 'No upcoming events' : 'No past events'} action={view === 'upcoming' && <Btn icon={Plus} onClick={() => setCreating(true)}>New event</Btn>} /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e, i) => (
            <article key={e.id} className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
              <div className={cx('relative h-40 bg-gradient-to-br', COVERS[i % COVERS.length])}>
                {e.photos?.[0] && <img src={e.photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                <div className="absolute left-4 top-4 rounded-2xl bg-white/95 px-3 py-2 text-center shadow"><p className="font-poppins text-[22px] font-bold leading-none text-slate-900">{new Date(e.date).getDate()}</p><p className="text-[12px] font-bold uppercase text-indigo-600">{new Date(e.date).toLocaleString('en-IN', { month: 'short' })}</p></div>
                {view === 'upcoming' && <span className="absolute right-4 top-4 rounded-full bg-black/40 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">in {daysBetween(today(), e.date)} days</span>}
              </div>
              <div className="p-5">
                <h3 className="font-poppins text-[18px] font-bold text-slate-900">{e.title}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-500"><MapPin className="h-3.5 w-3.5" />{e.venue || 'Venue to be announced'} · {e.audience}</p>
                {e.description && <p className="mt-3 line-clamp-3 text-[14px] leading-6 text-slate-600">{e.description}</p>}
                <div className="mt-4 flex items-center justify-between"><span className="text-[13px] text-slate-500">{(e.photos || []).length} photos</span><button onClick={async () => { if (await askConfirm(`Delete the event “${e.title}”?`)) events.remove(e.id); }} className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Delete event"><Trash2 className="h-4 w-4" /></button></div>
              </div>
            </article>
          ))}
        </div>
      )}
      {lightbox && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-6" onClick={() => setLightbox(null)}><img src={lightbox.src} alt={lightbox.title} data-keep-colors className="max-h-full max-w-full rounded-2xl" /></div>}
      <Drawer open={creating} onClose={() => setCreating(false)} title="New event" subtitle="Appears in the school calendar and Parent app"
        footer={<><Btn icon={Images} onClick={save} className="flex-1">Publish event</Btn><Btn variant="outline" onClick={() => setCreating(false)}>Cancel</Btn></>}>
        <Field label="Event"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Annual Day 2026" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="Venue"><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field></div>
        <Field label="Audience"><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={['Parents & students', 'Students only', 'Staff only', 'Whole school community']} /></Field>
        <Field label="Description"><TextArea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Photos (up to 6, max 450 KB each)">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-[14px] text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/40"><Images className="mb-2 h-6 w-6 text-indigo-500" />Click to add photos<input type="file" accept="image/*" multiple onChange={(e) => readPhotos(e.target.files)} className="hidden" /></label>
        </Field>
        {f.photos.length > 0 && <div className="grid grid-cols-3 gap-2">{f.photos.map((p, i) => <img key={i} src={p} alt="" className="h-20 w-full rounded-xl object-cover" />)}</div>}
      </Drawer>
    </Layout>
  );
};

/* ============================ SURVEYS & FEEDBACK ========================= */
const QTYPES = ['Rating (1–5)', 'Yes / No', 'Multiple choice', 'Open text'];
const QuestionPreview = ({ q, i }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4">
    <p className="text-[14px] font-semibold text-slate-800">{i + 1}. {q.text || 'Your question'}</p>
    <div className="mt-3">
      {q.type === 'Rating (1–5)' && <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cx('h-7 w-7', n <= 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />)}</div>}
      {q.type === 'Yes / No' && <div className="flex gap-2">{['Yes', 'No'].map((v) => <span key={v} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[13px] font-semibold text-slate-600">{v}</span>)}</div>}
      {q.type === 'Multiple choice' && <div className="space-y-1.5">{(q.options || 'Option A, Option B, Option C').split(',').map((o) => <p key={o} className="flex items-center gap-2 text-[13px] text-slate-600"><span className="h-4 w-4 rounded-full border-2 border-slate-300" />{o.trim()}</p>)}</div>}
      {q.type === 'Open text' && <div className="h-14 rounded-xl border border-slate-200 bg-slate-50" />}
    </div>
  </div>
);
export const Surveys = () => {
  const surveys = useLocalRecords('school_surveys', []);
  const [building, setBuilding] = useState(false);
  const [f, setF] = useState({ title: '', audience: 'Parents', questions: [{ text: '', type: 'Rating (1–5)' }] });
  const setQ = (i, patch) => setF({ ...f, questions: f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const templates = [
    { title: 'Term parent satisfaction', questions: [{ text: 'How happy are you with teaching quality?', type: 'Rating (1–5)' }, { text: 'How well does the school communicate with you?', type: 'Rating (1–5)' }, { text: 'Is the campus safe and clean?', type: 'Rating (1–5)' }, { text: 'What should we improve?', type: 'Open text' }] },
    { title: 'PTM feedback', questions: [{ text: 'Was the PTM slot timing convenient?', type: 'Yes / No' }, { text: 'Did teachers explain your child\'s progress clearly?', type: 'Rating (1–5)' }] },
    { title: 'Transport feedback', questions: [{ text: 'Is the bus on time?', type: 'Rating (1–5)' }, { text: 'Do you feel your child is safe on the bus?', type: 'Yes / No' }] },
  ];
  const publish = () => {
    const questions = f.questions.filter((q) => q.text.trim());
    if (!f.title.trim() || !questions.length) { notify('Add a title and at least one question.', 'error'); return; }
    surveys.add({ id: uid('SRV'), title: f.title, audience: f.audience, questions, status: 'Live', created_on: today(), responses: 0 });
    setF({ title: '', audience: f.audience, questions: [{ text: '', type: 'Rating (1–5)' }] }); setBuilding(false);
    notify('Survey published. Parents and staff answer it in the app.', 'success');
  };
  return (
    <Layout>
      <Hero icon={MessageSquareHeart} eyebrow="Voice of parents" title="Surveys & feedback" tone="teal"
        text="Run parent satisfaction, PTM and transport surveys with star ratings, yes/no and open questions. Parents answer in the app in under a minute."
        actions={<><DeviceNote /><HeroBtn light icon={Plus} onClick={() => setBuilding(true)}>New survey</HeroBtn></>}
        stats={[{ label: 'Live surveys', value: surveys.items.filter((s) => s.status === 'Live').length }, { label: 'Closed', value: surveys.items.filter((s) => s.status !== 'Live').length }, { label: 'Questions asked', value: surveys.items.reduce((n, s) => n + s.questions.length, 0) }, { label: 'Responses', value: surveys.items.reduce((n, s) => n + (s.responses || 0), 0) }]} />
      <div className="mb-6">
        <p className="mb-3 text-[14px] font-semibold text-slate-700">Start from a template</p>
        <div className="grid gap-3 md:grid-cols-3">
          {templates.map((t) => <button key={t.title} onClick={() => { setF({ title: t.title, audience: 'Parents', questions: t.questions }); setBuilding(true); }} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><Sparkles className="h-5 w-5" /></span><div><p className="text-[14px] font-bold text-slate-900">{t.title}</p><p className="text-[12px] text-slate-500">{t.questions.length} questions</p></div></button>)}
        </div>
      </div>
      {surveys.items.length === 0 ? <Empty icon={MessageSquareHeart} title="No surveys yet" text="Pick a template above or build your own." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {surveys.items.map((s) => (
            <div key={s.id} className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3"><p className="font-poppins text-[17px] font-bold text-slate-900">{s.title}</p><Chip tone={s.status === 'Live' ? 'green' : 'slate'}>{s.status}</Chip></div>
              <p className="mt-1 text-[13px] text-slate-500">{s.audience} · {s.questions.length} questions · {fmtDate(s.created_on)}</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="font-poppins text-[28px] font-bold text-slate-900">{s.responses || 0}</p><p className="text-[13px] text-slate-500">responses so far</p></div>
              <div className="mt-4 flex gap-2"><Btn variant="outline" className="flex-1" onClick={() => surveys.update(s.id, { status: s.status === 'Live' ? 'Closed' : 'Live' })}>{s.status === 'Live' ? 'Close survey' : 'Reopen'}</Btn><button aria-label="Delete survey" onClick={async () => { if (await askConfirm(`Delete “${s.title}”?`)) surveys.remove(s.id); }} className="rounded-xl border border-slate-200 px-3 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
            </div>
          ))}
        </div>
      )}
      <Drawer wide open={building} onClose={() => setBuilding(false)} title="Survey builder" subtitle="Left: questions · Right: what parents will see"
        footer={<><Btn icon={MessageSquareHeart} onClick={publish} className="flex-1">Publish survey</Btn><Btn variant="outline" onClick={() => setBuilding(false)}>Cancel</Btn></>}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Survey title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Audience"><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={['Parents', 'Students', 'Teachers', 'All staff']} /></Field>
            {f.questions.map((q, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between"><span className="text-[13px] font-bold text-slate-500">Question {i + 1}</span>{f.questions.length > 1 && <button onClick={() => setF({ ...f, questions: f.questions.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-600" aria-label="Remove question"><X className="h-4 w-4" /></button>}</div>
                <Input value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Type your question" />
                <Select value={q.type} onChange={(e) => setQ(i, { type: e.target.value })} options={QTYPES} />
                {q.type === 'Multiple choice' && <Input value={q.options || ''} onChange={(e) => setQ(i, { options: e.target.value })} placeholder="Options, separated by commas" />}
              </div>
            ))}
            <Btn variant="outline" icon={Plus} className="w-full" onClick={() => setF({ ...f, questions: [...f.questions, { text: '', type: 'Rating (1–5)' }] })}>Add question</Btn>
          </div>
          <div className="rounded-[28px] bg-slate-900 p-3">
            <div className="h-full space-y-3 rounded-[22px] bg-slate-100 p-4">
              <p className="text-center text-[12px] font-bold uppercase tracking-widest text-slate-400">Parent app preview</p>
              <p className="font-poppins text-[16px] font-bold text-slate-900">{f.title || 'Survey title'}</p>
              {f.questions.map((q, i) => <QuestionPreview key={i} q={q} i={i} />)}
              <div className="rounded-xl bg-indigo-600 py-3 text-center text-[14px] font-semibold text-white">Submit feedback</div>
            </div>
          </div>
        </div>
      </Drawer>
    </Layout>
  );
};

