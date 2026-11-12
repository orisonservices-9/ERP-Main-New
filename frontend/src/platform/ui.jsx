import React, { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export const serif = { fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" };
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
export const todayLabel = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortInr = (n) => { const v = Number(n || 0); if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1).replace(/\.0$/, '')} Cr`; if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')} L`; if (v >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`; return `₹${Math.round(v)}`; };
export const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const num = (value) => Number(value || 0).toLocaleString('en-IN');
export const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(`${value}Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const inputCls = 'h-10 w-full rounded-lg border border-[#DAD6CC] bg-white px-3 text-[14px] text-[#1F2433] outline-none focus:border-[#3F3A8C] focus:ring-2 focus:ring-[#3F3A8C]/15 disabled:bg-[#F4F1EA] disabled:text-[#8A8F9C]';
export const selectCls = inputCls.replace('w-full ', '');

export const PageHead = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 style={serif} className="text-[30px] font-medium leading-tight text-[#1F2433]">{title}</h1>
      {subtitle && <p className="mt-1 text-[14px] text-[#5B6070]">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Card = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`rounded-xl border border-[#E2DDD1] bg-white ${className}`}>
    {(title || action) && (
      <header className="flex items-start justify-between gap-3 border-b border-[#EEEAE0] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1F2433]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-[#5B6070]">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    <div className="p-5">{children}</div>
  </section>
);

export const Stat = ({ label, value, hint, tone = 'ink' }) => (
  <div className="rounded-xl border border-[#E2DDD1] bg-white px-5 py-4">
    <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">{label}</p>
    <p style={serif} className={`mt-1.5 text-[26px] font-medium leading-none ${tone === 'warn' ? 'text-[#B45309]' : tone === 'bad' ? 'text-[#B91C1C]' : 'text-[#1F2433]'}`}>{value}</p>
    {hint && <p className="mt-2 text-[12.5px] text-[#6B7080]">{hint}</p>}
  </div>
);

const pillTones = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200', amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-800 border-red-200', indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  gray: 'bg-[#F4F1EA] text-[#4A4F5C] border-[#E2DDD1]',
};
export const Pill = ({ tone = 'gray', children }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${pillTones[tone]}`}>{children}</span>
);
export const statusTone = { Active: 'green', Trial: 'indigo', Suspended: 'red', Expired: 'amber', Paid: 'green', Unpaid: 'amber', Cancelled: 'gray' };
export const planTone = { essential: 'gray', pro: 'indigo', premium: 'green' };

export const Btn = ({ children, onClick, variant = 'primary', disabled, busy, type = 'button', className = '', title }) => {
  const styles = {
    primary: 'bg-[#2E2A6E] text-white hover:bg-[#24205A]', ghost: 'border border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]',
    danger: 'bg-[#B91C1C] text-white hover:bg-[#991B1B]', quiet: 'text-[#3F3A8C] hover:bg-[#EEEAF8]',
  };
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled || busy}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
};

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-medium text-[#2B3040]">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[12px] text-[#6B7080]">{hint}</span>}
  </label>
);

export const Modal = ({ title, onClose, children, wide = false }) => {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Drawn on the page body, so the page's slide-in animation cannot pin the dim layer to the top of a long page.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1F2433]/45 p-4 pt-[8vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full rounded-2xl bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-[#EEEAE0] px-6 py-4">
          <h2 style={serif} className="text-[20px] font-medium text-[#1F2433]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-[#6B7080] hover:bg-[#F4F1EA]"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export const Empty = ({ children }) => <p className="py-8 text-center text-[14px] text-[#6B7080]">{children}</p>;
export const Loading = () => <div className="flex items-center justify-center py-20 text-[#6B7080]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading…</div>;
export const ErrorBox = ({ message, onRetry }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-900">
    {message} {onRetry && <button onClick={onRetry} className="ml-2 font-semibold underline">Try again</button>}
  </div>
);

export const THead = ({ cols }) => (
  <thead><tr className="border-b border-[#E2DDD1] text-left text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">
    {cols.map((c) => <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>)}
  </tr></thead>
);
export const TableWrap = ({ children }) => <div className="overflow-x-auto rounded-xl border border-[#E2DDD1] bg-white"><table className="w-full min-w-[720px] text-[14px]">{children}</table></div>;
export const Td = ({ children, className = '' }) => <td className={`border-b border-[#F0ECE2] px-4 py-3 align-middle text-[#1F2433] ${className}`}>{children}</td>;

export const Meter = ({ percent, level = 'ok' }) => (
  <div className="h-2 w-full min-w-[90px] rounded-full bg-[#EEEAE0]">
    <div className={`h-2 rounded-full ${level === 'over' ? 'bg-red-600' : level === 'warn' ? 'bg-amber-500' : 'bg-[#3F3A8C]'}`} style={{ width: `${Math.min(100, percent || 0)}%` }} />
  </div>
);
