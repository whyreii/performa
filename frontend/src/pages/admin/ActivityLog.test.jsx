import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ActivityLog from './ActivityLog';
import { adminApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const ENTRY = {
  id: 'log-1',
  organization_id: 'acme-ph',
  actor_id: 'u-admin',
  actor_name: 'Admin User',
  action: 'user.create',
  entity_type: 'user',
  entity_id: 'u-2',
  detail: 'employer:new@acme.com',
  created_at: '2026-03-01T00:00:00+00:00',
};

beforeEach(() => localStorage.clear());

describe('ActivityLog', () => {
  it('renders the system activity log', async () => {
    adminApi.listActivity.mockResolvedValue([ENTRY]);
    renderWithProviders(<ActivityLog />, { route: '/admin/activity', user: testUser('admin') });
    expect(
      await screen.findByRole('heading', { name: 'System Activity Log' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Admin User')).toBeInTheDocument();
  });
});
