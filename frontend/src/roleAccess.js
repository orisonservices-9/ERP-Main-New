// Frontend role map used by both navigation and direct-route protection.
// Admin remains the operational owner. Every other role receives only the
// screens needed for that person's day-to-day school responsibility.
export const ROLE_ACCESS = {
  admin: '*',
  director: {
    dashboard: ['/dashboard'],
    admissions: ['/admissions/reports'],
    academics: [
      '/academics/action-center', '/academics/student-health',
      '/academics/classroom-observations', '/teaching/observations',
      '/teaching/performance',
    ],
    attendance: ['/attendance/reports'],
    teachers: ['/teachers/allocations'],
    collections: ['/collections'],
    marks: ['/marks/results', '/marks/report-card'],
    leave: ['/leave/requests', '/leave/reports'],
    timetable: ['/timetable/reports'],
    notifications: ['/notifications'],
    transport: ['/transport'],
    visitor: ['/visitor', '/visitor/log'],
    multibranch: ['/multi-branch/overview', '/multi-branch/reports'],
    parent_center: ['/parent-center'],
    compliance: ['/compliance'],
    consents: ['/consents'],
    events: ['/events'],
    surveys: ['/surveys'],
  },
  academic_coordinator: {
    dashboard: ['/dashboard'],
    academics: [
      '/academics/action-center', '/academics/syllabus', '/academics/student-health',
      '/academics/support-plans', '/academics/classroom-observations',
      '/academics/interventions', '/teaching/observations', '/teaching/performance',
    ],
    attendance: ['/attendance/view', '/attendance/reports'],
    exams: ['/exams/create', '/exams/view'],
    marks: ['/marks/add', '/marks/results', '/marks/report-card'],
    homework: ['/homework/add', '/homework/reports'],
    timetable: ['/timetable/view', '/timetable/reports'],
    consents: ['/consents'],
    surveys: ['/surveys'],
    notifications: ['/notifications', '/notifications/send'],
  },
  fee_manager: {
    dashboard: ['/dashboard'],
    fee: [
      '/fee/create', '/fee/collect', '/fee/collections', '/fee/control-center',
      '/fee/receipts', '/fee/payment-verification',
    ],
    collections: ['/collections'],
    expenses: ['/expenses', '/expenses/record', '/expenses/register', '/expenses/reports'],
    hr: ['/hr-payroll'],
    notifications: ['/notifications', '/notifications/send'],
  },
  teacher: {
    dashboard: ['/dashboard'],
    attendance: ['/attendance/add', '/attendance/view'],
    marks: ['/marks/add', '/marks/results', '/marks/report-card'],
    homework: ['/homework/add', '/homework/reports'],
    timetable: ['/timetable/view'],
    leave: ['/leave/apply'],
    consents: ['/consents'],
    notifications: ['/notifications'],
  },
  stock_manager: {
    dashboard: ['/dashboard'],
    inventory: [
      '/inventory', '/inventory/purchase', '/inventory/parent-issue', '/inventory/register',
      '/inventory/movement', '/inventory/reports',
    ],
    notifications: ['/notifications'],
  },
  librarian: {
    dashboard: ['/dashboard'],
    library: ['/library', '/library/issues'],
    notifications: ['/notifications'],
  },
};

const MODULE_ROOTS = {
  // Only routes that immediately redirect to a permitted child belong here.
  // Real landing screens (for example /academics) must pass the normal rule.
  attendance: ['/attendance'],
  teachers: ['/teachers', '/teaching'],
  staff: ['/staff'],
  fee: ['/fee'],
  homework: ['/homework'],
  hall_tickets: ['/hall-tickets'],
  marks: ['/marks'],
  timetable: ['/timetable'],
  multibranch: ['/multi-branch'],
};

export const canAccessModule = (role, moduleKey) => {
  const access = ROLE_ACCESS[role];
  return access === '*' || Boolean(access?.[moduleKey]?.length);
};

export const canAccessPath = (role, pathname, moduleKey = '') => {
  const access = ROLE_ACCESS[role];
  if (access === '*') return true;
  if (!access) return false;
  const allowed = moduleKey ? access[moduleKey] || [] : Object.values(access).flat();
  if (allowed.includes(pathname)) return true;

  // Permit a module's redirect-only root. The destination still passes
  // through this same guard, so it cannot expose an unauthorised child page.
  if (moduleKey && (MODULE_ROOTS[moduleKey] || []).includes(pathname)) {
    return allowed.length > 0;
  }
  return false;
};

export const visibleNavigation = (role, navigation) => {
  if (ROLE_ACCESS[role] === '*') return navigation;
  return navigation.reduce((items, item) => {
    if (!canAccessModule(role, item.key)) return items;
    if (item.children) {
      const children = item.children.filter((child) => canAccessPath(role, child.path, item.key));
      if (children.length) items.push({ ...item, children });
      return items;
    }
    if (canAccessPath(role, item.path, item.key)) items.push(item);
    return items;
  }, []);
};

export const firstRolePath = (role, moduleKey, fallback = '/dashboard') => {
  const access = ROLE_ACCESS[role];
  if (access === '*') return fallback;
  return access?.[moduleKey]?.[0] || '/dashboard';
};

