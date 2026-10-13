import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import Register from './Register';
import { authApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderRegister(user = null) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<div>LOGIN PAGE</div>} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<div>EMPLOYER HOME</div>} />
    </Routes>,
    { route: '/register', user }
  );
}

function fillForm({ consent = true } = {}) {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Nadia Founder' } });
  fireEvent.change(screen.getByLabelText('Company / organization'), {
    target: { value: 'Bright Co.' },
  });
  fireEvent.change(screen.getByLabelText('Work email'), {
    target: { value: 'nadia@bright.test' },
  });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
  if (consent) fireEvent.click(screen.getByRole('checkbox'));
}

beforeEach(() => localStorage.clear());

describe('Register', () => {
  it('renders the sign-up form', () => {
    renderRegister();
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Company / organization')).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('requires every field', async () => {
    const { container } = renderRegister();
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please complete every field.');
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    const { container } = renderRegister();
    fillForm();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.'
    );
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('registers and navigates to the employer home', async () => {
    authApi.register.mockResolvedValue({ access_token: 't' });
    renderRegister(testUser('employer'));

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('EMPLOYER HOME')).toBeInTheDocument();
    expect(authApi.register).toHaveBeenCalledWith({
      fullName: 'Nadia Founder',
      email: 'nadia@bright.test',
      organizationName: 'Bright Co.',
      password: 'Password123!',
      consent: true,
    });
  });

  it('requires accepting the Data Privacy Notice', async () => {
    const { container } = renderRegister();
    fillForm({ consent: false });
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please accept the Data Privacy Notice'
    );
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('shows an alert when registration is rejected', async () => {
    authApi.register.mockRejectedValue({
      response: { data: { detail: 'An account with that email already exists.' } },
    });
    renderRegister();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with that email already exists.'
    );
  });
});
