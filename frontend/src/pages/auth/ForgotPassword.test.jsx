import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import { authApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/login" element={<div>LOGIN PAGE</div>} />
    </Routes>,
    { route: '/forgot-password' }
  );
}

beforeEach(() => localStorage.clear());

describe('ForgotPassword', () => {
  it('confirms after requesting a link without revealing whether the account exists', async () => {
    authApi.forgotPassword.mockResolvedValue({ status: 'accepted' });
    renderPage();

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'emp1@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists');
    expect(authApi.forgotPassword).toHaveBeenCalledWith('emp1@acme.com');
  });

  it('requires an email', async () => {
    const { container } = renderPage();
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please provide your work email.');
    expect(authApi.forgotPassword).not.toHaveBeenCalled();
  });
});
