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
  <span className={`inline-flex items-center gap-1 border text-[10px] font-bold uppercase tracking-[0.04em] px-2.5 py-1 rounded-full ${badgeColors[color]} ${className}`}>
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
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[12px] font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${styles[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
};

export const PageTitle = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between mb-7 gap-4">
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#635BFF] shadow-[0_0_0_4px_rgba(99,102,241,0.12)]" /><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">School operations</span></div>
      <h2 className="font-poppins text-[26px] leading-none font-bold tracking-[-0.035em] text-slate-900">{title}</h2>
      {subtitle && <p className="max-w-3xl text-[12px] leading-5 text-slate-500 mt-2">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
  </div>
);

export const Card = ({ title, subtitle, action, children, className = '', pad = 'p-6' }) => (
  <div className={`relative overflow-hidden bg-white/[0.92] rounded-2xl border border-white shadow-[0_12px_32px_rgba(15,23,42,0.055)] ring-1 ring-slate-100/90 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_18px_38px_rgba(15,23,42,0.075)] ${pad} ${className}`}>
    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <h3 className="font-poppins text-[16px] font-bold tracking-[-0.02em] text-slate-900">{title}</h3>}
          {subtitle && <p className="text-[11px] leading-5 text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

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
            {s.delta && <span className="text-[12px] font-semibold text-green-600">{s.delta}</span>}
          </div>
          <p className="text-[25px] font-poppins font-bold tracking-[-0.035em] text-slate-900 mt-4">{s.value}</p>
          <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
        </div>
      );
    })}
  </div>
);

export const SearchBar = ({ placeholder = 'Search...', className = '', value, onChange }) => (
  <div className={`relative ${className}`}>
    <Search className="w-4 h-4 text-[#b0b0b0] absolute left-3 top-1/2 -translate-y-1/2" />
    <input value={value} onChange={onChange} placeholder={placeholder} className="w-full h-10 rounded-xl bg-white border border-slate-200/90 pl-9 pr-3 text-[12px] text-slate-700 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition" />
  </div>
);

export const Field = ({ label, placeholder, value, select, type = 'text', options = [], onChange, name }) => (
  <div>
    {label && <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">{label}</label>}
    <div className="relative">
      {select ? (
        <select value={onChange ? value : undefined} defaultValue={onChange ? undefined : value} name={name} onChange={onChange} className="appearance-none w-full h-11 rounded-xl bg-white border border-slate-200 px-3.5 pr-9 text-[12px] font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition">
          {value && <option>{value}</option>}
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} placeholder={placeholder} value={onChange ? (value || '') : undefined} defaultValue={onChange ? undefined : value} name={name} onChange={onChange} className="w-full h-11 rounded-xl bg-white border border-slate-200 px-3.5 text-[12px] font-medium text-slate-700 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition" />
      )}
      {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
    </div>
  </div>
);

export const Table = ({ columns, children }) => (
  <table className="w-full text-left">
    <thead>
      <tr className="text-[10px] uppercase tracking-[0.1em] text-slate-400 border-b border-slate-100 bg-slate-50/70">
        {columns.map((c, i) => (
          <th key={i} className={`py-3 font-medium ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>{c.label}</th>
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
