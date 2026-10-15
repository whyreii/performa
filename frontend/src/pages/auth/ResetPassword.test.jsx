import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import { authApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderPage(user = null, route = '/reset-password?token=abc') {
  return renderWithProviders(
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={<div>LOGIN PAGE</div>} />
      <Route path="/dashboard" element={<div>EMPLOYER HOME</div>} />
    </Routes>,
    { route, user }
  );
}

beforeEach(() => localStorage.clear());

describe('ResetPassword', () => {
  it('shows an invalid-link message when the token is missing', () => {
    renderPage(null, '/reset-password');
    expect(screen.getByRole('alert')).toHaveTextContent('missing its token');
  });

  it('resets the password and signs the user in', async () => {
    authApi.resetPassword.mockResolvedValue({ access_token: 't' });
    renderPage(testUser('employer'));

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(await screen.findByText('EMPLOYER HOME')).toBeInTheDocument();
    expect(authApi.resetPassword).toHaveBeenCalledWith('abc', 'Password123!');
  });

  it('rejects mismatched passwords before calling the API', async () => {
    renderPage(testUser('employer'));
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'Different123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('generates a password into both fields and submits that value', async () => {
    authApi.resetPassword.mockResolvedValue({ access_token: 't' });
    renderPage(testUser('employer'));

    fireEvent.click(screen.getByRole('button', { name: 'Generate password' }));

    const first = screen.getByLabelText('New password').value;
    const second = screen.getByLabelText('Confirm new password').value;
    expect(first).toHaveLength(16);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/[0-9]/);
    expect(second).toBe(first);
    // The generated password is shown so it can be copied.
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByText('EMPLOYER HOME')).toBeInTheDocument();
    expect(authApi.resetPassword).toHaveBeenCalledWith('abc', first);
  });
});
