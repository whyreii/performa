import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { authApi } from '../api';

// Fresh client per test: no retries, no cross-test cache.
export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

// Renders a page under the full provider tree. When `user` is given, seeds the
// localStorage session and (if the api module is mocked) makes the mount
// hydration fetch resolve to it; otherwise the hydration fetch is rejected so
// the tree settles to the signed-out state.
export function renderWithProviders(ui, { route = '/', user = null, queryClient } = {}) {
  const client = queryClient || makeTestQueryClient();

  if (typeof authApi?.getCurrentUser?.mockResolvedValue === 'function') {
    if (user) {
      authApi.getCurrentUser.mockResolvedValue(user);
    } else {
      authApi.getCurrentUser.mockRejectedValue(new Error('no session'));
    }
  }

  if (user) {
    localStorage.setItem('performa_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('performa_user');
  }

  const result = render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return { ...result, queryClient: client };
}
