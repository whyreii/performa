import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import Settings from './Settings';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

beforeEach(() => localStorage.clear());

describe('Settings', () => {
  it('renders the profile section with the signed-in account context', async () => {
    renderWithProviders(<Settings />, { route: '/settings', user: testUser('employer') });
    expect(
      await screen.findByRole('heading', { name: 'Settings & Appearance' })
    ).toBeInTheDocument();
    expect(await screen.findByText('User Profile & Tenant')).toBeInTheDocument();
    expect(screen.getByText('employer@acme.com')).toBeInTheDocument();
  });
});
