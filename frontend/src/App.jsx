import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Route-level code splitting: each page is loaded on demand.
const Login = lazy(() => import('./pages/auth/Login'));
const AppShell = lazy(() => import('./components/layout/AppShell'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Employees = lazy(() => import('./pages/employees/Employees'));
const EmployeeDetail = lazy(() => import('./pages/employees/EmployeeDetail'));
const RateEmployee = lazy(() => import('./pages/supervisor/RateEmployee'));
const SupervisorDashboard = lazy(() => import('./pages/supervisor/SupervisorDashboard'));
const Rubrics = lazy(() => import('./pages/supervisor/Rubrics'));
const Dashboard = lazy(() => import('./pages/employer/Dashboard'));
const Rollups = lazy(() => import('./pages/employer/Rollups'));
const AuditTrail = lazy(() => import('./pages/admin/AuditTrail'));
const ActivityLog = lazy(() => import('./pages/admin/ActivityLog'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard'));
const EmployeeTraining = lazy(() => import('./pages/employee/EmployeeTraining'));
const Notifications = lazy(() => import('./pages/notifications/Notifications'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
    </div>
  );
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

function homeForRole(role) {
  return ROLE_HOME[role] || '/login';
}

function ProtectedRoute({ children, allowedRoles }) {
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
        <div className="max-w-md w-full bg-surface border border-line rounded-float p-6 text-center">
          <h2 className="text-lg font-semibold text-bad mb-2">Access Forbidden (403)</h2>
          <p className="text-sm text-ink-2 mb-4">
            Your account ({user?.role}) does not have permission to view this page.
          </p>
          <Link
            to={homeForRole(user?.role)}
            className="inline-flex items-center justify-center h-9 px-4 rounded-ctl bg-accent text-accent-foreground text-sm font-medium hover:brightness-110 transition-all"
          >
            Go to my dashboard
          </Link>
        </div>
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
                    <ProtectedRoute allowedRoles={['employer', 'admin', 'supervisor']}>
                      <Employees />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'admin', 'supervisor', 'probationary_employee']}>
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
                  path="/supervisor/rubrics"
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
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
              </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
}
