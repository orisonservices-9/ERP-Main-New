import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronUp, ChevronsLeft, ChevronsRight, LogOut, X } from 'lucide-react';
import { NAV_ITEMS } from '../mock';
import OrisonLogo from './OrisonLogo';
import { useAuth } from '../context/AuthContext';
import { visibleNavigation } from '../roleAccess';
import { t, useLang } from '../i18n';

// Responsive sidebar: full (272px) or icon-only (80px) on desktop, slide-in drawer below 1024px.
const Sidebar = ({ collapsed = false, mobileOpen = false, onClose = () => {}, onToggleCollapse = () => {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const { auth, logout, activeBranch } = useAuth();
  useLang();

  const items = visibleNavigation(auth?.role, NAV_ITEMS);
  const findOpen = () => items.find((i) => i.children && i.children.some((c) => path.startsWith(c.path)))?.key || '';
  const [openKey, setOpenKey] = useState(findOpen);

  useEffect(() => {
    const key = findOpen();
    if (key) setOpenKey(key);
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const isActive = (p) => p && path === p;
  const isChildActive = (p) => p && path.startsWith(p);
  const compact = collapsed && !mobileOpen;

  const go = (p) => { navigate(p); onClose(); };
  const handleParent = (item) => {
    if (item.children) {
      if (compact) { go(item.children[0].path); return; }
      setOpenKey((k) => (k === item.key ? '' : item.key));
    } else go(item.path);
  };
  const doLogout = () => { logout(); navigate('/'); };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        aria-label="Main navigation"
        data-keep-colors
        data-ui="sidebar"
        className={`flex flex-col overflow-hidden bg-gradient-to-b from-[#081126] via-[#111B3E] to-[#241A57] shadow-[14px_0_45px_rgba(15,23,42,0.18)] transition-all duration-300
          fixed inset-y-0 left-0 z-50 w-[288px] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:shrink-0 ${compact ? 'lg:w-[84px]' : 'lg:w-[272px]'}`}
      >
        <div data-ui="glow" className="pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
        <div data-ui="glow" className="pointer-events-none absolute -left-20 bottom-20 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative px-4 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <div className={`flex flex-1 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] ${compact ? 'px-1 py-2.5' : 'px-4 py-3.5'}`}>
              {compact ? <span className="font-poppins text-[18px] font-extrabold text-[#4F46E5]">O</span> : <OrisonLogo size="sm" />}
            </div>
            <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
          </div>
          {!compact && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.05] px-3 py-2.5">
              <div><p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">{t('School workspace')}</p><p className="mt-1 text-[13px] font-semibold text-white/85">{activeBranch?.name || 'Orison Main Campus'}</p></div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            </div>
          )}
        </div>

        <nav className="relative flex-1 overflow-y-auto sidebar-scroll px-3 pb-2 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const groupActive = isActive(item.path) || (item.children && item.children.some((c) => isChildActive(c.path)));
            const isOpen = openKey === item.key && !compact;
            return (
              <div key={item.key}>
                <button
                  onClick={() => handleParent(item)}
                  title={compact ? t(item.label) : undefined}
                  aria-expanded={item.children ? isOpen : undefined}
                  data-ui={groupActive ? 'nav-active' : undefined}
                  className={`w-full group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${compact ? 'justify-center' : ''}
                    ${groupActive ? 'bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-white shadow-[0_12px_24px_rgba(79,70,229,0.32)]' : 'text-white/[0.68] hover:bg-white/[0.08] hover:text-white'}`}
                >
                  <span data-icon={item.key} className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition ${groupActive ? 'bg-white/15' : 'bg-white/[0.06]'}`}>
                    <Icon className={`w-4 h-4 ${groupActive ? 'text-white' : 'text-white/[0.6] group-hover:text-white'}`} />
                  </span>
                  {!compact && <span className="flex-1 text-left truncate">{t(item.label)}</span>}
                  {!compact && item.children && <ChevronUp className={`w-4 h-4 shrink-0 text-white/40 transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`} />}
                </button>
                {item.children && isOpen && (
                  <div className="mt-1 mb-1 ml-5 border-l border-white/10 py-1">
                    {item.children.map((c) => (
                      <button key={c.path} onClick={() => go(c.path)}
                        data-ui={isChildActive(c.path) ? 'nav-child-active' : undefined}
                        className={`relative w-full text-left pl-8 pr-3 py-2 text-[13px] transition-colors
                          ${isChildActive(c.path) ? 'text-cyan-200 font-semibold before:absolute before:-left-[3px] before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-cyan-300' : 'text-white/[0.55] hover:text-white/[0.9]'}`}>
                        {t(c.label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="relative space-y-2 px-3 pb-4 pt-2">
          <button onClick={onToggleCollapse} className="hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium text-white/50 hover:bg-white/[0.06] hover:text-white lg:flex" aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}>
            {compact ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> {t('Collapse menu')}</>}
          </button>
          <button onClick={doLogout} title={compact ? 'Sign out' : undefined} className={`w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-[13px] font-medium text-white/[0.7] hover:bg-white/[0.08] hover:text-white transition ${compact ? 'justify-center' : ''}`}>
            <span className="w-8 h-8 rounded-xl bg-white/[0.07] flex items-center justify-center shrink-0"><LogOut className="w-4 h-4 text-indigo-300" /></span>
            {!compact && t('Sign out securely')}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
