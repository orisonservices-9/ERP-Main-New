import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Gauge, Handshake, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Menu, Receipt, Tags, Users, X, Wallet, HandCoins, Route as RouteIcon, FileBarChart, Banknote, ReceiptText, Activity } from 'lucide-react';
import pApi, { getToken, setToken } from './platformApi';
import { Loading, greeting, serif, todayLabel } from './ui';
import { Ctx, usePlatform } from './platformContext';
import { PlatformLogin, SetupTwoFactor } from './PlatformLogin';
import PlatformDashboard from './PlatformDashboard';
import { SchoolsList, SchoolDetail } from './PlatformSchools';
import { InvoicesPage, PlansPage, UsagePage } from './PlatformBilling';
import { AccountPage, AuditPage, TeamPage } from './PlatformTeam';
import { SupportList, SupportTicket } from './PlatformSupport';
import { LeadDetail, SalesPipeline } from './PlatformSales';
import { DevPage } from './PlatformDev';
import { CollectionsPage, FinanceHome, MyExpensesPage, PayrollPage, ReportsPage, TravelPage } from './PlatformFinance';

const Provider = ({ children }) => {
  const [state, setState] = useState({ loading: true, user: null, permissions: [], needs2fa: false });

  const refresh = useCallback(async () => {
    if (!getToken()) { setState({ loading: false, user: null, permissions: [], needs2fa: false }); return null; }
    try {
      const { data } = await pApi.get('/auth/me');
      setState({ loading: false, user: data.user, permissions: data.permissions, needs2fa: data.needs_2fa_setup });
      return data;
    } catch {
      setToken(null);
      setState({ loading: false, user: null, permissions: [], needs2fa: false });
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    try { await pApi.post('/auth/logout'); } catch { /* ignore */ }
    setToken(null);
    setState({ loading: false, user: null, permissions: [], needs2fa: false });
  }, []);

  const value = useMemo(() => ({
    ...state, refresh, signOut,
    can: (permission) => state.permissions.includes('*') || state.permissions.includes(permission),
  }), [state, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

const NAV = [
  { group: 'Overview', to: '/platform', end: true, label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:read' },
  { group: 'Sales and schools', to: '/platform/sales', label: 'Sales pipeline', icon: Handshake, perm: 'leads:own' },
  { group: 'Sales and schools', to: '/platform/schools', label: 'Schools', icon: Building2, perm: 'schools:read' },
  { group: 'Sales and schools', to: '/platform/usage', label: 'Usage & alerts', icon: Gauge, perm: 'usage:read' },
  { group: 'Support', to: '/platform/dev', label: 'Health & releases', icon: Activity, perm: 'tickets:read' },
  { group: 'Support', to: '/platform/support', label: 'Support tickets', icon: LifeBuoy, perm: 'tickets:read' },
  { group: 'Accounts', to: '/platform/finance', end: true, label: 'Accounts desk', icon: Wallet, perm: 'finance:read' },
  { group: 'Accounts', to: '/platform/finance/collections', label: 'Collections', icon: HandCoins, perm: 'finance:read' },
  { group: 'Accounts', to: '/platform/finance/travel', label: 'Travel & expenses', icon: RouteIcon, perm: 'finance:read' },
  { group: 'Accounts', to: '/platform/finance/payroll', label: 'Salaries & expenses', icon: Banknote, perm: 'finance:read' },
  { group: 'Accounts', to: '/platform/finance/reports', label: 'Reports', icon: FileBarChart, perm: 'finance:read' },
  { group: 'Accounts', to: '/platform/expenses', label: 'My expenses', icon: ReceiptText, perm: 'expenses:own', notOwner: true },
  { group: 'Accounts', to: '/platform/invoices', label: 'Invoices', icon: Receipt, perm: 'billing:read' },
  { group: 'Settings', to: '/platform/plans', label: 'Plans & pricing', icon: Tags, perm: 'dashboard:read' },
  { group: 'Settings', to: '/platform/team', label: 'Team', icon: Users, perm: 'team:read' },
  { group: 'Settings', to: '/platform/audit', label: 'Audit log', icon: ClipboardList, perm: 'audit:read' },
  { to: '/platform/account', label: 'My account', icon: KeyRound },
];

const Shell = ({ children }) => {
  const { user, can, signOut } = usePlatform();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/platform-sw.js', { scope: '/platform' }).catch(() => {}); }, []);
  const links = NAV.filter((item) => (!item.perm || can(item.perm)) && !(item.notOwner && can('*')));
  const leave = async () => { await signOut(); navigate('/platform/login', { replace: true }); };
  const Nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {links.map(({ to, end, label, icon: Icon, group }, i) => (
        <React.Fragment key={to}>
          {links.length > 7 && group && group !== links[i - 1]?.group && <p className={`px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#8F8BBE] ${i === 0 ? '' : 'pt-3'}`}>{group}</p>}
          <NavLink to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition ${isActive ? 'bg-white text-[#2E2A6E]' : 'text-[#D9D5EC] hover:bg-white/10'}`}>
            <Icon className="h-[18px] w-[18px]" />{label}
          </NavLink>
        </React.Fragment>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#1F2433] lg:flex" data-testid="platform-shell">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#24224F] lg:flex print:!hidden">
        <div className="px-5 pb-2 pt-6"><div className="rounded-xl bg-white px-4 py-3"><img src="/orison-logo.svg" alt="Orison Services" className="h-auto w-full" /></div><p className="mt-3 text-[12px] uppercase tracking-widest text-[#B9B4D8]">Platform admin</p></div>
        {Nav}
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-[13px] font-medium text-white">{user?.name}</p>
          <p className="truncate text-[12px] capitalize text-[#B9B4D8]">{user?.role} · {user?.email}</p>
          <button onClick={leave} className="mt-3 flex items-center gap-2 text-[13px] text-[#D9D5EC] hover:text-white"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-[#24224F]">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 text-white"><X className="h-5 w-5" /></button>
            <div className="px-5 pb-2 pt-6"><div className="rounded-xl bg-white px-4 py-3"><img src="/orison-logo.svg" alt="Orison Services" className="h-auto w-full" /></div><p className="mt-3 text-[12px] uppercase tracking-widest text-[#B9B4D8]">Platform admin</p></div>
            {Nav}
            <button onClick={leave} className="m-4 flex items-center gap-2 text-[13px] text-[#D9D5EC]"><LogOut className="h-4 w-4" />Sign out</button>
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-[#E2DDD1] bg-[#FBF9F4] px-4 py-3 lg:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
          <img src="/orison-logo.svg" alt="Orison Services" className="h-8 w-auto" /><span className="text-[12px] uppercase tracking-widest text-[#6B7080]">Platform admin</span>
        </header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-[#E2DDD1] bg-[#FBF9F4] px-4 py-3 sm:px-8 print:hidden" data-testid="greeting-bar">
          <p style={serif} className="text-[19px] text-[#1F2433]">{greeting()}, {(user?.name || '').split(' ')[0] || 'there'}</p>
          <p className="text-[13px] text-[#6B7080]">{todayLabel()}</p>
        </div>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
};

const Guard = ({ perm, children }) => {
  const { loading, user, needs2fa, can } = usePlatform();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/platform/login" replace />;
  if (needs2fa) return <Navigate to="/platform/setup-2fa" replace />;
  // A Developer only has support tickets: send them straight there instead of an empty dashboard
  if (perm === 'dashboard:read' && !can(perm)) {
    if (can('leads:own')) return <Navigate to="/platform/sales" replace />;
    if (can('finance:read')) return <Navigate to="/platform/finance" replace />;
    if (can('tickets:read')) return <Navigate to="/platform/dev" replace />;
  }
  if (perm && !can(perm)) return <Shell><p className="py-24 text-center text-[15px] text-[#5B6070]">Your platform role does not include this page.</p></Shell>;
  return <Shell>{children}</Shell>;
};

const PlatformApp = () => (
  <Provider>
    <Routes>
      <Route path="login" element={<PlatformLogin />} />
      <Route path="setup-2fa" element={<SetupTwoFactor />} />
      <Route index element={<Guard perm="dashboard:read"><PlatformDashboard /></Guard>} />
      <Route path="schools" element={<Guard perm="schools:read"><SchoolsList /></Guard>} />
      <Route path="schools/:id" element={<Guard perm="schools:read"><SchoolDetail /></Guard>} />
      <Route path="usage" element={<Guard perm="usage:read"><UsagePage /></Guard>} />
      <Route path="sales" element={<Guard perm="leads:own"><SalesPipeline /></Guard>} />
      <Route path="sales/:id" element={<Guard perm="leads:own"><LeadDetail /></Guard>} />
      <Route path="dev" element={<Guard perm="tickets:read"><DevPage /></Guard>} />
      <Route path="support" element={<Guard perm="tickets:read"><SupportList /></Guard>} />
      <Route path="support/:id" element={<Guard perm="tickets:read"><SupportTicket /></Guard>} />
      <Route path="finance" element={<Guard perm="finance:read"><FinanceHome /></Guard>} />
      <Route path="finance/collections" element={<Guard perm="finance:read"><CollectionsPage /></Guard>} />
      <Route path="finance/travel" element={<Guard perm="finance:read"><TravelPage /></Guard>} />
      <Route path="finance/payroll" element={<Guard perm="finance:read"><PayrollPage /></Guard>} />
      <Route path="expenses" element={<Guard perm="expenses:own"><MyExpensesPage /></Guard>} />
      <Route path="finance/reports" element={<Guard perm="finance:read"><ReportsPage /></Guard>} />
      <Route path="invoices" element={<Guard perm="billing:read"><InvoicesPage /></Guard>} />
      <Route path="plans" element={<Guard perm="dashboard:read"><PlansPage /></Guard>} />
      <Route path="team" element={<Guard perm="team:read"><TeamPage /></Guard>} />
      <Route path="audit" element={<Guard perm="audit:read"><AuditPage /></Guard>} />
      <Route path="account" element={<Guard><AccountPage /></Guard>} />
      <Route path="*" element={<Navigate to="/platform" replace />} />
    </Routes>
  </Provider>
);

export default PlatformApp;
