import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ProtectedRoute, homeForRole } from '../App';
import { authApi } from '../api';
import { testUser } from '../test/apiMock';

vi.mock('../api', async () => (await import('../test/apiMock')).createApiMock());

function renderProtected(path, allowedRoles) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path="/login" element={<div>LOGIN PAGE</div>} />
                <Route
                  path="/protected"
                  element={
                    <ProtectedRoute allowedRoles={allowedRoles}>
                      <div>SECRET</div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => localStorage.clear());

describe('homeForRole', () => {
  it('maps each role to its home route', () => {
    expect(homeForRole('admin')).toBe('/admin/users');
    expect(homeForRole('employer')).toBe('/dashboard');
    expect(homeForRole('supervisor')).toBe('/supervisor/dashboard');
    expect(homeForRole('probationary_employee')).toBe('/employee/dashboard');
    expect(homeForRole('unknown')).toBe('/login');
  });
});

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to the login page', async () => {
    authApi.getCurrentUser.mockRejectedValue(new Error('no session'));
    renderProtected('/protected', ['employer']);
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
  });

  it('shows 403 and a role-home link for a disallowed role', async () => {
    authApi.getCurrentUser.mockResolvedValue(testUser('supervisor'));
    renderProtected('/protected', ['employer']);
    expect(await screen.findByText(/Access Forbidden/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to my dashboard' })).toHaveAttribute(
      'href',
      '/supervisor/dashboard'
    );
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
  });

  it('renders children for an allowed role', async () => {
    authApi.getCurrentUser.mockResolvedValue(testUser('employer'));
    renderProtected('/protected', ['employer']);
    expect(await screen.findByText('SECRET')).toBeInTheDocument();
  });
});
