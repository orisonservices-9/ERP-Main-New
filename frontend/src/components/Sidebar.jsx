import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronUp, LogOut } from 'lucide-react';
import { NAV_ITEMS } from '../mock';
import OrisonLogo from './OrisonLogo';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const { auth, logout } = useAuth();

  const menu = auth?.role === 'academic_coordinator'
    ? ['dashboard', 'academics', 'notifications']
    : auth?.menu; // null = admin (all keys)
  const items = menu ? NAV_ITEMS.filter((i) => menu.includes(i.key)) : NAV_ITEMS;

  const initialOpen = () => {
    const found = items.find((i) => i.children && i.children.some((c) => path.startsWith(c.path)));
    return found ? found.key : '';
  };
  const [openKey, setOpenKey] = useState(initialOpen);

  useEffect(() => {
    const found = items.find((i) => i.children && i.children.some((c) => path.startsWith(c.path)));
    if (found) setOpenKey(found.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const isActive = (p) => p && path === p;
  const isChildActive = (p) => p && path.startsWith(p);

  const handleParent = (item) => {
    if (item.children) setOpenKey((k) => (k === item.key ? '' : item.key));
    else navigate(item.path);
  };

  const doLogout = () => { logout(); navigate('/'); };

  return (
    <aside className="relative w-[272px] shrink-0 h-screen sticky top-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#081126] via-[#111B3E] to-[#241A57] shadow-[14px_0_45px_rgba(15,23,42,0.18)]">
      <div className="pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-20 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="relative px-4 pt-5 pb-4">
        <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
          <OrisonLogo size="sm" />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.05] px-3 py-2.5">
          <div><p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/[0.35]">School workspace</p><p className="mt-1 text-[11px] font-semibold text-white/80">Orison Main Campus</p></div>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
        </div>
      </div>

      <nav className="relative flex-1 overflow-y-auto sidebar-scroll px-3 pb-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const groupActive = isActive(item.path) || (item.children && item.children.some((c) => isChildActive(c.path)));
          const isOpen = openKey === item.key;
          return (
            <div key={item.key}>
              <button
                onClick={() => handleParent(item)}
                className={`w-full group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-all duration-200
                  ${groupActive ? 'bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-white shadow-[0_12px_24px_rgba(79,70,229,0.32)]' : 'text-white/[0.62] hover:bg-white/[0.08] hover:text-white'}`}
              >
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition ${groupActive ? 'bg-white/15' : 'bg-white/[0.06]'}`}>
                  <Icon className={`w-4 h-4 ${groupActive ? 'text-white' : 'text-white/[0.55] group-hover:text-white'}`} />
                </span>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.children && (
                  <ChevronUp className={`w-3.5 h-3.5 shrink-0 text-white/40 transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`} />
                )}
              </button>
              {item.children && isOpen && (
                <div className="mt-1 mb-1 ml-5 border-l border-white/10 py-1">
                  {item.children.map((c) => (
                    <button
                      key={c.path}
                      onClick={() => navigate(c.path)}
                      className={`relative w-full text-left pl-8 pr-3 py-2 text-[11px] transition-colors
                        ${isChildActive(c.path) ? 'text-cyan-200 font-semibold before:absolute before:-left-[3px] before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-cyan-300' : 'text-white/[0.45] hover:text-white/[0.85]'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="relative px-3 pb-4 pt-2">
        <button onClick={doLogout} className="w-full flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-[12px] font-medium text-white/[0.65] hover:bg-white/[0.08] hover:text-white transition">
          <span className="w-8 h-8 rounded-xl bg-white/[0.07] flex items-center justify-center shrink-0"><LogOut className="w-4 h-4 text-indigo-300" /></span>
          Sign out securely
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
