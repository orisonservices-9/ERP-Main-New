import React from 'react';
import { Search, ChevronDown } from 'lucide-react';

const badgeColors = {
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-[#C4141B]',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  gray: 'bg-gray-100 text-gray-500',
  purple: 'bg-purple-50 text-purple-600',
};

export const Badge = ({ children, color = 'gray', className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${badgeColors[color]} ${className}`}>
    {children}
  </span>
);

export const Btn = ({ children, icon: Icon, variant = 'primary', onClick, className = '', type = 'button' }) => {
  const styles = {
    primary: 'bg-[#C4141B] hover:bg-[#a91116] text-white shadow-sm',
    outline: 'border border-gray-200 text-[#555] hover:bg-gray-50 bg-white',
    dark: 'bg-[#1a1a1a] hover:bg-black text-white',
    ghost: 'text-[#C4141B] hover:bg-red-50',
  };
  return (
    <button type={type} onClick={onClick} className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-[13px] font-medium transition ${styles[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
};

export const PageTitle = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between mb-6 gap-4">
    <div>
      <h2 className="font-poppins text-[24px] font-bold text-[#1a1a1a]">{title}</h2>
      {subtitle && <p className="text-[13px] text-[#8a8a8a] mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
  </div>
);

export const Card = ({ title, subtitle, action, children, className = '', pad = 'p-6' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${pad} ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">{title}</h3>}
          {subtitle && <p className="text-[12px] text-[#a0a0a0] mt-0.5">{subtitle}</p>}
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
        <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.tint || 'bg-red-50 text-[#C4141B]'}`}>
              <Icon className="w-5 h-5" />
            </span>
            {s.delta && <span className="text-[12px] font-semibold text-green-600">{s.delta}</span>}
          </div>
          <p className="text-[24px] font-poppins font-bold text-[#1a1a1a] mt-4">{s.value}</p>
          <p className="text-[13px] text-[#8a8a8a]">{s.label}</p>
        </div>
      );
    })}
  </div>
);

export const SearchBar = ({ placeholder = 'Search...', className = '', value, onChange }) => (
  <div className={`relative ${className}`}>
    <Search className="w-4 h-4 text-[#b0b0b0] absolute left-3 top-1/2 -translate-y-1/2" />
    <input value={value} onChange={onChange} placeholder={placeholder} className="w-full h-10 rounded-lg bg-[#f4f4f5] border border-[#ececee] pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition" />
  </div>
);

export const Field = ({ label, placeholder, value, select, type = 'text', options = [] }) => (
  <div>
    {label && <label className="block text-[12px] text-[#8a8a8a] mb-1.5">{label}</label>}
    <div className="relative">
      {select ? (
        <select defaultValue={value} className="appearance-none w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 pr-9 text-[13px] text-[#333] focus:outline-none focus:ring-2 focus:ring-red-100 transition">
          {value && <option>{value}</option>}
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} placeholder={placeholder} defaultValue={value} className="w-full h-11 rounded-lg bg-[#f6f6f7] border border-[#ececee] px-3.5 text-[13px] text-[#333] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition" />
      )}
      {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
    </div>
  </div>
);

export const Table = ({ columns, children }) => (
  <table className="w-full text-left">
    <thead>
      <tr className="text-[11px] uppercase tracking-wide text-[#9a9a9a] border-b border-gray-100">
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

export const ProgressBar = ({ value, color = 'bg-[#C4141B]' }) => (
  <div className="h-2 rounded-full bg-gray-100 overflow-hidden w-full">
    <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
  </div>
);

export const Toolbar = ({ children }) => (
  <div className="flex flex-wrap items-center gap-3 mb-4">{children}</div>
);
