import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CommandPalette from './CommandPalette';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SetupReminderBar } from './SetupChecklist';

const Layout = ({ children, showTopBar = true }) => {
  const { auth } = useAuth();
  const { pathname } = useLocation();
  const showSetupBar = auth?.role === 'admin' && pathname !== '/dashboard';
  // Warm off-white sidebar (login-screen palette) on every Admin screen.
  const warmTheme = auth?.role === 'admin';
  const [serverStatus, setServerStatus] = useState({ online: true, detail: '' });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('orison_sidebar_collapsed') === '1'; } catch { return false; } });
  const toggleCollapse = () => setCollapsed((value) => { try { localStorage.setItem('orison_sidebar_collapsed', value ? '0' : '1'); } catch { /* ignore */ } return !value; });

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener('orison-open-menu', open);
    return () => window.removeEventListener('orison-open-menu', open);
  }, []);

  useEffect(() => {
    const handleApiStatus = (event) => {
      const { status, detail = '' } = event.detail || {};
      setServerStatus({ online: status !== 'offline', detail });
    };

    window.addEventListener('orison-api-status', handleApiStatus);
    return () => window.removeEventListener('orison-api-status', handleApiStatus);
  }, []);

  return (
    <div className={`flex min-h-screen bg-[#F7F8FC] ${warmTheme ? 'orison-warm' : ''}`}>
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onToggleCollapse={toggleCollapse} />
      <CommandPalette />
      <main className="flex-1 min-w-0 flex flex-col bg-[radial-gradient(circle_at_92%_2%,_rgba(99,102,241,0.13),_transparent_25%),radial-gradient(circle_at_48%_100%,_rgba(45,212,191,0.08),_transparent_28%),#F8FAFF]">
        {showTopBar && <TopBar />}
        {!serverStatus.online && (
          <div className="mx-4 mt-5 sm:mx-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:mx-8">
            <div>
              <p className="font-bold">School server temporarily unavailable</p>
              <p className="mt-1 text-sm text-amber-800">
                {serverStatus.detail} Your entered information has not been submitted.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 rounded-xl bg-amber-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-900"
            >
              Reconnect
            </button>
          </div>
        )}
        <div className="flex-1 px-4 pb-14 pt-6 sm:px-6 lg:px-8">{showSetupBar && <SetupReminderBar />}{children}</div>
      </main>
    </div>
  );
};

export default Layout;
