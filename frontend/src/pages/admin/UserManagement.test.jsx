import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import UserManagement from './UserManagement';
import { adminApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const USER = {
  id: 'u-1',
  email: 'ada@acme.com',
  full_name: 'Ada Admin',
  role: 'employer',
  organization_id: 'acme-ph',
  organization_name: 'Acme Philippines Corp.',
  is_active: true,
  created_at: '2026-01-01T00:00:00+00:00',
};

beforeEach(() => localStorage.clear());

describe('UserManagement', () => {
  it('lists platform accounts and exposes the role filter', async () => {
    adminApi.listUsers.mockResolvedValue([USER]);
    adminApi.listOrganizations.mockResolvedValue([
      { name: 'Acme Philippines Corp.', slug: 'acme-ph' },
    ]);
    renderWithProviders(<UserManagement />, {
      route: '/admin/users',
      user: testUser('admin'),
    });

    expect(await screen.findByRole('heading', { name: 'Account Management' })).toBeInTheDocument();
    expect((await screen.findAllByText('Ada Admin')).length).toBeGreaterThan(0);
    expect(screen.getByRole('radiogroup', { name: 'Filter by role' })).toBeInTheDocument();
  });
});
