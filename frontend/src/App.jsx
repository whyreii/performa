import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';

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

function ProtectedPlaceholder({ roleRequired, title }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-bg text-ink p-8 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-surface border border-line rounded-float p-6 shadow-pop text-center space-y-4">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-ink-2">
          Signed in as <b>{user?.full_name}</b> ({user?.email})
        </p>
        <div className="inline-block px-3 py-1 rounded-ctl bg-accent/10 text-accent font-medium text-xs">
          Role: {user?.role}
        </div>
        <div className="pt-4 border-t border-line">
          <button
            onClick={logout}
            className="px-4 py-2 rounded-ctl border border-line hover:bg-hover text-sm font-medium transition-colors"
          >
            Sign out
          </button>
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

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['employer', 'admin']}>
                    <ProtectedPlaceholder title="Employer Dashboard" />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/supervisor/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['supervisor', 'employer', 'admin']}>
                    <ProtectedPlaceholder title="Supervisor Dashboard" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['probationary_employee']}>
                    <ProtectedPlaceholder title="Employee Scorecard & Dashboard" />
                  </ProtectedRoute>
                }
              />

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
