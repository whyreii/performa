// Single source of truth for role-based navigation.
//
// Paths and icons are defined once in ROUTES. Each role's navigation is declared
// per surface (sidebar, mobile tab bar, command palette) so labels/order are
// preserved exactly while role membership stays consistent across the app.

import {
  Activity,
  Award,
  Bell,
  BookOpen,
  FileCheck2,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Target,
  Users,
} from '../components/icons';

export const ROUTES = {
  adminUsers: { path: '/admin/users', icon: ShieldCheck },
  adminActivity: { path: '/admin/activity', icon: Activity },
  employees: { path: '/employees', icon: Users },
  audits: { path: '/audits', icon: History },
  notifications: { path: '/notifications', icon: Bell },
  settings: { path: '/settings', icon: Settings },
  dashboard: { path: '/dashboard', icon: LayoutDashboard },
  rollups: { path: '/rollups', icon: FileCheck2 },
  reports: { path: '/reports', icon: FileText },
  supervisorDashboard: { path: '/supervisor/dashboard', icon: LayoutDashboard },
  rate: { path: '/supervisor/rate', icon: Award },
  rubrics: { path: '/rubrics', icon: Target },
  employeeDashboard: { path: '/employee/dashboard', icon: Award },
  training: { path: '/employee/training', icon: BookOpen },
};

// Each role's sidebar is declared as labelled sections (Manage / Compliance /
// Account) so the sidebar can group a long nav. `sidebarNav` flattens the
// sections back into a plain list, so every existing consumer (AppShell chunk
// prefetch, tests) keeps working unchanged; only the Sidebar reads the groups.
export const NAV_BY_ROLE = {
  admin: {
    sidebar: [
      { label: 'Manage', items: [['adminUsers', 'User Accounts'], ['adminActivity', 'Activity Log']] },
      { label: 'Account', items: [['notifications', 'Notifications'], ['settings', 'Settings']] },
    ],
    tabs: [
      ['adminUsers', 'Accounts'],
      ['adminActivity', 'Activity'],
      ['settings', 'Settings'],
    ],
    commands: [
      ['adminUsers', 'Manage User Accounts'],
      ['adminActivity', 'System Activity Log'],
    ],
  },
  employer: {
    sidebar: [
      {
        label: 'Manage',
        items: [
          ['dashboard', 'Dashboard'],
          ['employees', 'Employees'],
          ['rubrics', 'KPI Configuration'],
          ['rollups', 'Rollups & AI Plans'],
          ['reports', 'Reports'],
        ],
      },
      { label: 'Compliance', items: [['audits', 'Audit Trail'], ['notifications', 'Notifications']] },
      { label: 'Account', items: [['settings', 'Settings']] },
    ],
    tabs: [
      ['dashboard', 'Overview'],
      ['employees', 'Directory'],
      ['rollups', 'Rollups'],
      ['audits', 'Audits'],
      ['settings', 'Settings'],
    ],
    commands: [
      ['dashboard', 'Go to Employer Dashboard'],
      ['employees', 'View Employee Directory'],
      ['rubrics', 'KPI Configuration & Rubrics'],
      ['rollups', 'Monthly Rollups & AI Plans'],
      ['reports', 'Generate Employee Reports'],
      ['audits', 'Audit Trail & Compliance Logs'],
    ],
  },
  supervisor: {
    sidebar: [
      {
        label: 'Manage',
        items: [
          ['supervisorDashboard', 'Supervisor Dashboard'],
          ['employees', 'Employees'],
          ['rate', 'Rate Employee'],
          ['rubrics', 'KPI Rubrics'],
        ],
      },
      { label: 'Account', items: [['notifications', 'Notifications'], ['settings', 'Settings']] },
    ],
    tabs: [
      ['supervisorDashboard', 'Overview'],
      ['employees', 'Team'],
      ['rate', 'Rate'],
      ['rubrics', 'Rubrics'],
      ['settings', 'Settings'],
    ],
    commands: [
      ['supervisorDashboard', 'Supervisor Dashboard'],
      ['employees', 'Team Directory'],
      ['rate', 'Rate Probationary Employee'],
      ['rubrics', 'View KPI Rubrics'],
    ],
  },
  probationary_employee: {
    sidebar: [
      { label: 'Manage', items: [['employeeDashboard', 'My Scorecard'], ['training', 'Training Plans']] },
      { label: 'Account', items: [['notifications', 'Notifications'], ['settings', 'Settings']] },
    ],
    tabs: [
      ['employeeDashboard', 'Scorecard'],
      ['training', 'Training'],
      ['settings', 'Settings'],
    ],
    commands: [
      ['employeeDashboard', 'My Scorecard & Evaluations'],
      ['training', 'My Training Interventions'],
    ],
  },
};

function resolve(pairs) {
  return pairs.map(([key, label]) => ({
    label,
    path: ROUTES[key].path,
    icon: ROUTES[key].icon,
  }));
}

// Grouped sidebar entries for the Sidebar component: [{ label, items: [...] }].
export function sidebarSections(role) {
  return (NAV_BY_ROLE[role]?.sidebar || []).map((section) => ({
    label: section.label,
    items: resolve(section.items),
  }));
}

// Flattened sidebar entries (unchanged contract for prefetch + tests).
export function sidebarNav(role) {
  return sidebarSections(role).flatMap((section) => section.items);
}

export function tabNav(role) {
  return resolve(NAV_BY_ROLE[role]?.tabs || []);
}

export function commandNav(role) {
  return resolve(NAV_BY_ROLE[role]?.commands || []);
}
