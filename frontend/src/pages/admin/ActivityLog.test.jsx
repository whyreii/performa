import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import ActivityLog from './ActivityLog';
import { adminApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const ENTRY = {
  id: 'log-1',
  organization_id: 'acme-ph',
  organization_name: 'Acme Philippines Corp.',
  actor_id: 'u-admin',
  actor_name: 'Admin User',
  action: 'user.create',
  entity_type: 'user',
  entity_id: 'u-2',
  detail: 'employer:new@acme.com',
  created_at: '2026-03-01T00:00:00+00:00',
};

const SECOND = {
  ...ENTRY,
  id: 'log-2',
  actor_id: 'u-employer',
  actor_name: 'Cecile Robelo',
  action: 'kpi.update',
  entity_type: 'kpi_rubric',
  detail: 'task_completion: target=4.0 weight=0.2',
};

beforeEach(() => localStorage.clear());

describe('ActivityLog', () => {
  it('renders the system activity log with the tenant', async () => {
    adminApi.listActivity.mockResolvedValue([ENTRY]);
    renderWithProviders(<ActivityLog />, { route: '/admin/activity', user: testUser('admin') });
    expect(
      await screen.findByRole('heading', { name: 'System Activity Log' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Acme Philippines Corp.')).toBeInTheDocument();
  });

  it('narrows the rows by the search query', async () => {
    adminApi.listActivity.mockResolvedValue([ENTRY, SECOND]);
    renderWithProviders(<ActivityLog />, { route: '/admin/activity', user: testUser('admin') });

    expect(await screen.findByText('Admin User')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search activity log'), {
      target: { value: 'cecile' },
    });

    expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
    expect(screen.getByText('Cecile Robelo')).toBeInTheDocument();
  });
});
