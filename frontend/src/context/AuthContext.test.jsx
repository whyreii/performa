import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '../api';
import { testUser } from '../test/apiMock';

vi.mock('../api', async () => (await import('../test/apiMock')).createApiMock());

function Probe() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [result, setResult] = useState('');
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? 'in' : 'out'}</span>
      <span data-testid="role">{user?.role || 'none'}</span>
      <span data-testid="result">{result}</span>
      <button
        type="button"
        onClick={async () => setResult(JSON.stringify(await login('e@acme.com', 'pw')))}
      >
        login
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
}

function renderAuth() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => localStorage.clear());

describe('AuthContext', () => {
  it('hydrates the user from the session on mount', async () => {
    authApi.getCurrentUser.mockResolvedValue(testUser('employer'));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('in'));
    expect(screen.getByTestId('role')).toHaveTextContent('employer');
  });

  it('settles to signed-out when the session is invalid', async () => {
    authApi.getCurrentUser.mockRejectedValue(new Error('no session'));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('out'));
  });

  it('logs in successfully and stores the user', async () => {
    authApi.getCurrentUser.mockRejectedValue(new Error('no session'));
    authApi.login.mockResolvedValue({ access_token: 't' });
    authApi.getCurrentUser.mockResolvedValue(testUser('supervisor'));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('out'));

    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('in'));
    expect(authApi.login).toHaveBeenCalledWith('e@acme.com', 'pw');
    expect(screen.getByTestId('role')).toHaveTextContent('supervisor');
  });

  it('returns {success:false} on failed login', async () => {
    authApi.getCurrentUser.mockRejectedValue(new Error('no session'));
    authApi.login.mockRejectedValue({ response: { data: { detail: 'Incorrect email or password' } } });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('out'));

    fireEvent.click(screen.getByText('login'));

    await waitFor(() =>
      expect(screen.getByTestId('result')).toHaveTextContent('Incorrect email or password')
    );
    expect(screen.getByTestId('auth')).toHaveTextContent('out');
  });

  it('logs out and clears the session', async () => {
    authApi.getCurrentUser.mockResolvedValue(testUser('employer'));
    authApi.logout.mockResolvedValue({});
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('in'));

    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('out'));
    expect(authApi.logout).toHaveBeenCalled();
  });
});
