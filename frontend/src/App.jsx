import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import AppShell from './components/layout/AppShell';

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

function ProtectedPlaceholder({ roleRequired, title, description }) {
  const { user, logout } = useAuth();
  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="text-sm text-ink-2 mt-1">
            {description || 'Philippine Labor Code Article 296 Evaluation System'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2.5 py-1 rounded-ctl bg-accent/10 border border-accent/20 text-accent font-medium capitalize">
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
      </header>

      <div className="bg-surface border border-line rounded-float p-6 sm:p-8 shadow-sm">
        <h2 className="text-base font-semibold text-ink mb-2">Connected Tenant: Acme Philippines Corp.</h2>
        <p className="text-sm text-ink-2 mb-6">
          Logged in as <b className="text-ink">{user?.full_name}</b> (<span className="font-mono">{user?.email}</span>).
          All API routes and database transactions are isolated by <code>organization_id</code>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-ctl bg-hover border border-line">
            <span className="text-ink-3 block mb-1">Timezone</span>
            <span className="font-semibold text-ink">Asia/Manila (UTC+8)</span>
          </div>
          <div className="p-3.5 rounded-ctl bg-hover border border-line">
            <span className="text-ink-3 block mb-1">Probation Cap</span>
            <span className="font-semibold text-ink">180 Strict Calendar Days</span>
          </div>
          <div className="p-3.5 rounded-ctl bg-hover border border-line">
            <span className="text-ink-3 block mb-1">Milestone Alerts</span>
            <span className="font-semibold text-ink">Days 150 · 165 · 178</span>
          </div>
        </div>
      </div>
    </div>
  );
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
                {/* Employer & Admin Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'admin']}>
                      <ProtectedPlaceholder
                        title="Executive Dashboard"
                        description="Probationary employee pipeline, 180-day timeline tracker, and AI intervention recommendations."
                      />
                    </ProtectedRoute>
                  }
                />
                <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'admin', 'supervisor']}>
                      <ProtectedPlaceholder
                        title="Employee Directory"
                        description="Active probationary employees, statutory milestone status, and performance cohorts."
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rollups"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'admin']}>
                      <ProtectedPlaceholder
                        title="Monthly Rollups & AI Plans"
                        description="Review and sign off on automated 30-day Gemini evaluation rollups and ML course assignments."
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audits"
                  element={
                    <ProtectedRoute allowedRoles={['employer', 'admin']}>
                      <ProtectedPlaceholder
                        title="Audit Trail & Statutory Logs"
                        description="Cryptographically secured, immutable evaluation history complying with Article 296 due process standards."
                      />
                    </ProtectedRoute>
                  }
                />

                {/* Supervisor Routes */}
                <Route
                  path="/supervisor/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer', 'admin']}>
                      <ProtectedPlaceholder
                        title="Supervisor Workspace"
                        description="Direct report evaluations, weekly rating queues, and competency tracking."
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor/rate"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer', 'admin']}>
                      <ProtectedPlaceholder
                        title="Rate Probationary Employee"
                        description="Weekly 5-competency evaluation matrix with target 4.0 marker and required behavioral remarks."
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor/rubrics"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'employer', 'admin']}>
                      <ProtectedPlaceholder
                        title="KPI Rubrics & Performance Criteria"
                        description="The 5 statutory competencies established and acknowledged on Day 1 of probation."
                      />
                    </ProtectedRoute>
                  }
                />

                {/* Employee Routes */}
                <Route
                  path="/employee/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['probationary_employee']}>
                      <ProtectedPlaceholder
                        title="My Performance Scorecard"
                        description="Your weekly evaluation ratings, competency benchmarks, and statutory milestone progress."
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employee/training"
                  element={
                    <ProtectedRoute allowedRoles={['probationary_employee']}>
                      <ProtectedPlaceholder
                        title="Assigned Training Interventions"
                        description="AI-recommended learning modules to close identified competency gaps."
                      />
                    </ProtectedRoute>
                  }
                />

                {/* Common Settings Route */}
                <Route
                  path="/settings"
                  element={
                    <ProtectedPlaceholder
                      title="Settings & Appearance"
                      description="Manage account credentials, active color palettes, and statutory notification preferences."
                    />
                  }
                />
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
