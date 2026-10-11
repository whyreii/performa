// Route-chunk loaders, keyed by nav path.
//
// App.jsx feeds these to React.lazy, and navigation links call prefetchRoute on
// hover/focus so the chunk is already downloaded (and, in dev, transformed) before
// the click. That removes the ~1–2s Suspense wait on first navigation to a route.

export const routeLoaders = {
  '/login': () => import('../pages/auth/Login'),
  '/admin/users': () => import('../pages/admin/UserManagement'),
  '/admin/activity': () => import('../pages/admin/ActivityLog'),
  '/employees': () => import('../pages/employees/EmployeeSplit'),
  '/employees/:id': () => import('../pages/employees/EmployeeDetail'),
  '/audits': () => import('../pages/admin/AuditTrail'),
  '/notifications': () => import('../pages/notifications/Notifications'),
  '/settings': () => import('../pages/settings/Settings'),
  '/dashboard': () => import('../pages/employer/Dashboard'),
  '/rollups': () => import('../pages/employer/Rollups'),
  '/reports': () => import('../pages/employer/Reports'),
  '/supervisor/dashboard': () => import('../pages/supervisor/SupervisorDashboard'),
  '/supervisor/rate': () => import('../pages/supervisor/RateEmployee'),
  '/rubrics': () => import('../pages/supervisor/Rubrics'),
  '/employee/dashboard': () => import('../pages/employee/EmployeeDashboard'),
  '/employee/training': () => import('../pages/employee/EmployeeTraining'),
};

const prefetched = new Set();

// Fire-and-forget: a failed prefetch is harmless — React.lazy retries on navigation.
export function prefetchRoute(path) {
  if (!path || prefetched.has(path)) return;
  const loader = routeLoaders[path];
  if (!loader) return;
  prefetched.add(path);
  Promise.resolve(loader()).catch(() => prefetched.delete(path));
}
