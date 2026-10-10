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

  const menu = auth?.menu; // null = all keys
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
    <aside className="w-[248px] shrink-0 h-screen sticky top-0 flex flex-col bg-gradient-to-b from-[#E8262D] via-[#E01E26] to-[#C4141B]">
      <div className="px-4 pt-5 pb-4">
        <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-center shadow-sm">
          <OrisonLogo size="sm" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 pb-2 space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const groupActive = isActive(item.path) || (item.children && item.children.some((c) => isChildActive(c.path)));
          const isOpen = openKey === item.key;
          return (
            <div key={item.key}>
              <button
                onClick={() => handleParent(item)}
                className={`w-full group flex items-center gap-2.5 rounded-full pl-2 pr-3 py-2 text-[12.5px] font-medium transition-all duration-200
                  ${groupActive ? 'bg-white text-[#C4141B] shadow-sm' : 'bg-white/95 text-[#3a3a3a] hover:bg-white'}`}
              >
                <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-inner border border-red-100 shrink-0">
                  <Icon className={`w-3.5 h-3.5 ${groupActive ? 'text-[#E01E26]' : 'text-[#8a8a8a]'}`} />
                </span>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.children && (
                  <ChevronUp className={`w-3.5 h-3.5 shrink-0 text-[#9a9a9a] transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`} />
                )}
              </button>
              {item.children && isOpen && (
                <div className="mt-1 mb-1 rounded-xl bg-white/15 py-1.5">
                  {item.children.map((c) => (
                    <button
                      key={c.path}
                      onClick={() => navigate(c.path)}
                      className={`w-full text-left pl-11 pr-3 py-1.5 text-[12px] transition-colors
                        ${isChildActive(c.path) ? 'text-white font-semibold' : 'text-white/85 hover:text-white'}`}
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

      <div className="px-3 pb-4 pt-2">
        <button onClick={doLogout} className="w-full flex items-center gap-2.5 rounded-full pl-2 pr-3 py-2 text-[12.5px] font-medium bg-white/15 text-white hover:bg-white/25 transition">
          <span className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shrink-0"><LogOut className="w-3.5 h-3.5 text-[#E01E26]" /></span>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
