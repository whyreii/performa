import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { Surface } from './components/ui';
import { routeLoaders } from './routes/loaders';

// Route-level code splitting: each page is loaded on demand. The loaders live in
// routes/loaders.js so navigation links can prefetch a chunk on hover/focus.
const Login = lazy(routeLoaders['/login']);
const AppShell = lazy(() => import('./components/layout/AppShell'));
const Settings = lazy(routeLoaders['/settings']);
const EmployeeSplit = lazy(routeLoaders['/employees']);
const EmployeeDetail = lazy(routeLoaders['/employees/:id']);
const RateEmployee = lazy(routeLoaders['/supervisor/rate']);
const SupervisorDashboard = lazy(routeLoaders['/supervisor/dashboard']);
const Rubrics = lazy(routeLoaders['/rubrics']);
const Dashboard = lazy(routeLoaders['/dashboard']);
const Rollups = lazy(routeLoaders['/rollups']);
const Reports = lazy(routeLoaders['/reports']);
const AuditTrail = lazy(routeLoaders['/audits']);
const ActivityLog = lazy(routeLoaders['/admin/activity']);
const UserManagement = lazy(routeLoaders['/admin/users']);
const EmployeeDashboard = lazy(routeLoaders['/employee/dashboard']);
const EmployeeTraining = lazy(routeLoaders['/employee/training']);
const Notifications = lazy(routeLoaders['/notifications']);
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
    </div>
  );
}

// Per-route document titles (WCAG 2.4.2). Longest/most-specific paths first.
const ROUTE_TITLES = [
  ['/employees/', 'Employee Detail'],
  ['/admin/users', 'User Accounts'],
  ['/admin/activity', 'Activity Log'],
  ['/supervisor/dashboard', 'Supervisor Dashboard'],
  ['/supervisor/rate', 'Rate Employee'],
  ['/rubrics', 'KPI Rubrics'],
  ['/employee/dashboard', 'My Scorecard'],
  ['/employee/training', 'Training Plans'],
  ['/employees', 'Employee Directory'],
  ['/dashboard', 'Dashboard'],
  ['/rollups', 'Rollups & AI Plans'],
  ['/reports', 'Reports'],
  ['/audits', 'Audit Trail'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
  ['/login', 'Sign in'],
];

function titleForPath(pathname) {
  const match = ROUTE_TITLES.find(
    ([path]) => pathname === path || pathname.startsWith(path.endsWith('/') ? path : `${path}/`)
  );
  return match ? match[1] : null;
}

function RouteTitle() {
  const location = useLocation();
  useDocumentTitle(titleForPath(location.pathname));
  return null;
}

// Create TanStack Query client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: (failureCount, error) => {
        // Do not retry 4xx client errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const ROLE_HOME = {
  admin: '/admin/users',
  employer: '/dashboard',
  supervisor: '/supervisor/dashboard',
  probationary_employee: '/employee/dashboard',
};

export function homeForRole(role) {
  return ROLE_HOME[role] || '/login';
}

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Surface flat className="max-w-md w-full p-6 text-center">
          <h2 className="text-22 font-semibold text-bad mb-2">Access Forbidden (403)</h2>
          <p className="text-14 text-ink-2 mb-4">
            Your account ({user?.role}) does not have permission to view this page.
          </p>
          <Link
            to={homeForRole(user?.role)}
            className="inline-flex items-center justify-center h-9 px-4 rounded-ctl bg-accent text-accent-foreground text-14 font-medium hover:brightness-110 transition"
          >
            Go to my dashboard
          </Link>
        </Surface>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <RouteTitle />
              <Suspense fallback={<RouteFallback />}>
              <Routes>
              {/* Public route */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes wrapped in AppShell */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                {/* Admin Exclusive User Management Route */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route path="/admin/dashboard" element={<Navigate to="/admin/users" replace />} />
                <Route path="/admin/overview" element={<Navigate to="/admin/users" replace />} />
                <Route
                  path="/admin/activity"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ActivityLog />
                    </ProtectedRoute>
                  }
                />

                {/* Employer & Admin Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['employer']}>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'supervisor', 'probationary_employee']}>
                      <EmployeeSplit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'supervisor', 'probationary_employee']}>
                      <EmployeeDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rollups"
                  element={
                    <ProtectedRoute allowedRoles={['employer']}>
                      <Rollups />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute allowedRoles={['employer']}>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audits"
                  element={
                    <ProtectedRoute allowedRoles={['employer']}>
                      <AuditTrail />
                    </ProtectedRoute>
                  }
                />

                {/* Supervisor Routes */}
                <Route
                  path="/supervisor/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer']}>
                      <SupervisorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor/rate"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer']}>
                      <RateEmployee />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rubrics"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer']}>
                      <Rubrics />
                    </ProtectedRoute>
                  }
                />

                {/* Employee Routes */}
                <Route
                  path="/employee/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['probationary_employee']}>
                      <EmployeeDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employee/training"
                  element={
                    <ProtectedRoute allowedRoles={['probationary_employee']}>
                      <EmployeeTraining />
                    </ProtectedRoute>
                  }
                />

                {/* Common Settings Route */}
                <Route path="/settings" element={<Settings />} />
                <Route path="/notifications" element={<Notifications />} />
              </Route>

              {/* Default fallback */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
              </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
}
