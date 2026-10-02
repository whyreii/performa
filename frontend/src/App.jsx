import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import AppShell from './components/layout/AppShell';
import Settings from './pages/settings/Settings';
import Employees from './pages/employees/Employees';
import EmployeeDetail from './pages/employees/EmployeeDetail';
import RateEmployee from './pages/supervisor/RateEmployee';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import Rubrics from './pages/supervisor/Rubrics';
import Dashboard from './pages/employer/Dashboard';
import Rollups from './pages/employer/Rollups';
import AuditTrail from './pages/admin/AuditTrail';
import UserManagement from './pages/admin/UserManagement';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeTraining from './pages/employee/EmployeeTraining';

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
          <Navigate to="/login" replace />
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
          <BrowserRouter>
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
                    <ProtectedRoute allowedRoles={['employer', 'admin', 'supervisor']}>
                      <EmployeeDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rollups"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'admin']}>
                      <Rollups />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audits"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'admin']}>
                      <AuditTrail />
                    </ProtectedRoute>
                  }
                />

                {/* Supervisor Routes */}
                <Route
                  path="/supervisor/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer', 'admin']}>
                      <SupervisorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor/rate"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer', 'admin']}>
                      <RateEmployee />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor/rubrics"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer', 'admin']}>
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
              </Route>

              {/* Default fallback */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
