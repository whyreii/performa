import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import Login from './Login';
import { authApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderLogin(user = null) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<div>EMPLOYER HOME</div>} />
      <Route path="/supervisor/dashboard" element={<div>SUPERVISOR HOME</div>} />
    </Routes>,
    { route: '/login', user }
  );
}

beforeEach(() => localStorage.clear());

describe('Login', () => {
  it('renders the sign-in form', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('validates that both fields are required', async () => {
    const { container } = renderLogin();
    // Submit the form directly: native `required` would otherwise block submit.
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please provide both your email and password.'
    );
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('submits credentials and navigates to the role home', async () => {
    authApi.login.mockResolvedValue({ access_token: 't' });
    authApi.getCurrentUser.mockResolvedValue(testUser('employer'));
    renderLogin(testUser('employer'));

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'employer@acme.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('EMPLOYER HOME')).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith('employer@acme.com', 'Password123!');
  });

  it('shows an alert on failed authentication', async () => {
    authApi.login.mockRejectedValue({ response: { data: { detail: 'Incorrect email or password' } } });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'wrong@acme.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });
});
