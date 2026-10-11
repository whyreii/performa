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
  supervisorDashboard: { path: '/supervisor/dashboard', icon: LayoutDashboard },
  rate: { path: '/supervisor/rate', icon: Award },
  rubrics: { path: '/rubrics', icon: Target },
  employeeDashboard: { path: '/employee/dashboard', icon: Award },
  training: { path: '/employee/training', icon: BookOpen },
};

// Each entry is [routeKey, label]; order is preserved per surface.
export const NAV_BY_ROLE = {
  admin: {
    sidebar: [
      ['adminUsers', 'User Accounts'],
      ['adminActivity', 'Activity Log'],
      ['rubrics', 'KPI Rubrics'],
      ['notifications', 'Notifications'],
      ['settings', 'Settings'],
    ],
    tabs: [
      ['adminUsers', 'Accounts'],
      ['adminActivity', 'Activity'],
      ['rubrics', 'Rubrics'],
      ['settings', 'Settings'],
    ],
    commands: [
      ['adminUsers', 'Manage User Accounts'],
      ['adminActivity', 'System Activity Log'],
      ['rubrics', 'View KPI Rubrics'],
    ],
  },
  employer: {
    sidebar: [
      ['dashboard', 'Dashboard'],
      ['employees', 'Employees'],
      ['rubrics', 'KPI Configuration'],
      ['rollups', 'Rollups & AI Plans'],
      ['audits', 'Audit Trail'],
      ['notifications', 'Notifications'],
      ['settings', 'Settings'],
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
      ['audits', 'Audit Trail & Compliance Logs'],
    ],
  },
  supervisor: {
    sidebar: [
      ['supervisorDashboard', 'Supervisor Dashboard'],
      ['employees', 'Employees'],
      ['rate', 'Rate Employee'],
      ['rubrics', 'KPI Rubrics'],
      ['notifications', 'Notifications'],
      ['settings', 'Settings'],
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
      ['employeeDashboard', 'My Scorecard'],
      ['training', 'Training Plans'],
      ['notifications', 'Notifications'],
      ['settings', 'Settings'],
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

export function sidebarNav(role) {
  return resolve(NAV_BY_ROLE[role]?.sidebar || []);
}

export function tabNav(role) {
  return resolve(NAV_BY_ROLE[role]?.tabs || []);
}

export function commandNav(role) {
  return resolve(NAV_BY_ROLE[role]?.commands || []);
}
