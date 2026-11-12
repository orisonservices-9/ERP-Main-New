import React from 'react';
import { Search, ChevronDown } from 'lucide-react';

const badgeColors = {
  green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  red: 'border-indigo-100 bg-indigo-50 text-[#4338CA]',
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  gray: 'border-slate-200 bg-slate-50 text-slate-600',
  purple: 'border-purple-100 bg-purple-50 text-purple-700',
};

export const Badge = ({ children, color = 'gray', className = '' }) => (
  <span className={`inline-flex items-center gap-1 border text-[12px] font-bold uppercase tracking-[0.04em] px-2.5 py-1 rounded-full ${badgeColors[color]} ${className}`}>
    {children}
  </span>
);

export const Btn = ({ children, icon: Icon, variant = 'primary', onClick, className = '', type = 'button', disabled = false }) => {
  const styles = {
    primary: 'bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] hover:from-[#4338CA] hover:via-[#5B5FEF] hover:to-[#7C3AED] text-white shadow-[0_9px_18px_rgba(79,70,229,0.24)] hover:shadow-[0_13px_25px_rgba(79,70,229,0.34)]',
    outline: 'border border-slate-200 text-slate-700 hover:border-indigo-100 hover:bg-indigo-50 hover:text-[#4338CA] bg-white shadow-sm',
    dark: 'bg-slate-900 hover:bg-black text-white shadow-[0_9px_18px_rgba(15,23,42,0.18)]',
    ghost: 'text-[#4F46E5] hover:bg-indigo-50',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${styles[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
};

// Page header used by most module screens: the same indigo banner style as the newer screens.
export const PageTitle = ({ title, subtitle, actions, eyebrow = 'School operations' }) => (
  <div className="relative mb-6 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0F1736] via-[#1E1B4B] to-[#4338CA] px-6 py-6 text-white shadow-[0_22px_50px_-24px_rgba(67,56,202,0.75)] sm:px-8 sm:py-7">
    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/[0.07]" />
    <div className="pointer-events-none absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-violet-400/10 blur-2xl" />
    <div className="relative flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-semibold text-indigo-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{eyebrow}</span>
        <h2 className="mt-3 font-poppins text-[24px] font-bold leading-tight tracking-[-0.03em] sm:text-[28px]">{title}</h2>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-indigo-100/75">{subtitle}</p>}
      </div>
      {actions && <div className="orison-hero-actions flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  </div>
);

export const Card = ({ title, subtitle, action, children, className = '', pad = 'p-6' }) => {
  const flush = /(^|\s)p-0(\s|$)/.test(pad);
  return (
  <div className={`relative overflow-hidden bg-white rounded-[22px] border border-white shadow-[0_12px_32px_rgba(15,23,42,0.055)] ring-1 ring-slate-100/90 transition-shadow duration-200 hover:shadow-[0_18px_38px_rgba(15,23,42,0.075)] ${pad} ${className}`}>
    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
    {(title || action) && (
      <div className={`flex flex-wrap items-center justify-between gap-3 ${flush ? 'border-b border-slate-100 px-6 py-4' : 'mb-4'}`}>
        <div>
          {title && <h3 className="font-poppins text-[16px] font-bold tracking-[-0.02em] text-slate-900">{title}</h3>}
          {subtitle && <p className="text-[13px] leading-5 text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
  );
};

export const StatCards = ({ items }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
    {items.map((s) => {
      const Icon = s.icon;
      return (
        <div key={s.label} className="group relative overflow-hidden bg-white/95 rounded-2xl border border-white ring-1 ring-slate-100 shadow-[0_10px_30px_rgba(31,23,26,0.055)] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)]">
          <div className="absolute right-0 top-0 h-20 w-20 translate-x-7 -translate-y-7 rounded-full bg-gradient-to-br from-indigo-50 to-transparent opacity-70" />
          <div className="flex items-center justify-between">
            <span className={`relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${s.tint || 'bg-indigo-50 text-[#4F46E5]'}`}>
              <Icon className="w-5 h-5" />
            </span>
            {s.delta && <span className="text-[13px] font-semibold text-green-600">{s.delta}</span>}
          </div>
          <p className="text-[25px] font-poppins font-bold tracking-[-0.035em] text-slate-900 mt-4">{s.value}</p>
          <p className="text-[13px] font-medium text-slate-500">{s.label}</p>
        </div>
      );
    })}
  </div>
);

export const SearchBar = ({ placeholder = 'Search...', className = '', value, onChange }) => (
  <div className={`relative ${className}`}>
    <Search className="w-4 h-4 text-[#b0b0b0] absolute left-3 top-1/2 -translate-y-1/2" />
    <input value={value} onChange={onChange} placeholder={placeholder} className="w-full h-10 rounded-xl bg-white border border-slate-200/90 pl-9 pr-3 text-[13px] text-slate-700 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition" />
  </div>
);

export const Field = ({ label, placeholder, value, select, type = 'text', options = [], onChange, name }) => (
  <div>
    {label && <label className="block text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">{label}</label>}
    <div className="relative">
      {select ? (
        <select value={onChange ? value : undefined} defaultValue={onChange ? undefined : value} name={name} onChange={onChange} className="appearance-none w-full h-11 rounded-xl bg-white border border-slate-200 px-3.5 pr-9 text-[13px] font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition">
          {value && <option>{value}</option>}
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} placeholder={placeholder} value={onChange ? (value || '') : undefined} defaultValue={onChange ? undefined : value} name={name} onChange={onChange} className="w-full h-11 rounded-xl bg-white border border-slate-200 px-3.5 text-[13px] font-medium text-slate-700 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition" />
      )}
      {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
    </div>
  </div>
);

export const Table = ({ columns, children }) => (
  <table className="w-full text-left">
    <thead>
      <tr className="text-[12px] uppercase tracking-[0.08em] text-slate-500 border-b border-slate-100 bg-slate-50/80">
        {columns.map((c, i) => (
          <th key={i} className={`py-3 font-semibold ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>{c.label}</th>
        ))}
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

export const Avatar = ({ src, alt, size = 9 }) => (
  <img src={src} alt={alt} className={`w-${size} h-${size} rounded-full object-cover`} />
);

export const ProgressBar = ({ value, color = 'bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6]' }) => (
  <div className="h-2 rounded-full bg-slate-100 overflow-hidden w-full shadow-inner">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
  </div>
);

export const Toolbar = ({ children }) => (
  <div className="flex flex-wrap items-center gap-3 mb-5 rounded-2xl border border-slate-100 bg-white/75 p-3 shadow-sm">{children}</div>
);

// Step-by-step form: shows one group of fields at a time with a progress header.
// The browser checks each step's required fields before moving on.
export const StepForm = ({ steps, onSubmit, submitLabel = 'Save', submitIcon: SubmitIcon, saving = false, resetSignal, className = '' }) => {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => { setStep(0); }, [resetSignal]);
  const last = step === steps.length - 1;
  const current = steps[step];
  const handle = (event) => {
    event.preventDefault();
    const problem = current.validate ? current.validate() : null;
    if (problem) { window.alert(problem); return; }
    if (!last) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    onSubmit(event);
  };
  return (
    <form onSubmit={handle} className={`overflow-hidden rounded-[22px] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.055)] ring-1 ring-slate-100 ${className}`}>
      <ol className="flex items-stretch gap-0 border-b border-slate-100 bg-slate-50/70 px-3 sm:px-5">
        {steps.map((item, index) => {
          const state = index < step ? 'done' : index === step ? 'current' : 'todo';
          return (
            <li key={item.title} className="flex min-w-0 flex-1 items-center">
              <button type="button" disabled={index > step} onClick={() => setStep(index)} className={`flex min-w-0 flex-1 items-center gap-2.5 border-b-2 px-2 py-4 text-left transition sm:px-3 ${state === 'current' ? 'border-[#4F46E5]' : 'border-transparent'} ${index > step ? 'cursor-default' : 'hover:bg-white/60'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'current' ? 'bg-[#4F46E5] text-white shadow-[0_0_0_4px_rgba(79,70,229,0.15)]' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>{state === 'done' ? '✓' : index + 1}</span>
                <span className="hidden min-w-0 sm:block"><b className={`block truncate text-[13px] ${state === 'todo' ? 'text-slate-400' : 'text-slate-800'}`}>{item.title}</b>{item.note && <span className="block truncate text-[12px] text-slate-400">{item.note}</span>}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="p-5 sm:p-6">
        <p className="mb-4 text-[12px] font-semibold text-slate-400 sm:hidden">Step {step + 1} of {steps.length} · <span className="text-slate-700">{current.title}</span></p>
        {current.content}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} className={`h-10 rounded-xl px-4 text-[13px] font-bold text-slate-600 transition hover:bg-white ${step === 0 ? 'invisible' : ''}`}>← Back</button>
        <span className="hidden text-[12px] text-slate-400 sm:block">Step {step + 1} of {steps.length}</span>
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-5 text-[13px] font-bold text-white shadow-[0_9px_18px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 disabled:opacity-60">
          {last ? <>{SubmitIcon && <SubmitIcon className="h-4 w-4" />}{saving ? 'Saving…' : submitLabel}</> : <>Next: {steps[step + 1].title} →</>}
        </button>
      </div>
    </form>
  );
};

// Read-only summary used on the last step of a StepForm.
export const ReviewList = ({ items }) => (
  <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2">
    {items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[12px] font-semibold text-slate-400">{label}</dt><dd className="truncate text-[13.5px] font-semibold text-slate-800">{value || '—'}</dd></div>)}
  </dl>
);
