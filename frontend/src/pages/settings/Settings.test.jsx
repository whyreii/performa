import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import Settings from './Settings';
import { adminApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

beforeEach(() => localStorage.clear());

describe('Settings', () => {
  it('renders the profile section with the signed-in account context', async () => {
    renderWithProviders(<Settings />, { route: '/settings', user: testUser('employer') });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveValue('employer@acme.com');
  });

  it('shows a left rail of settings sections', async () => {
    renderWithProviders(<Settings />, { route: '/settings', user: testUser('employer') });
    const rail = await screen.findByRole('navigation', { name: 'Settings sections' });
    expect(within(rail).getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(within(rail).getByRole('link', { name: 'Appearance' })).toBeInTheDocument();
    expect(within(rail).getByRole('link', { name: 'Account' })).toBeInTheDocument();
  });

  it('shows the read-only System settings section to an administrator', async () => {
    adminApi.getSettings.mockResolvedValue({
      deadline_thresholds: { day_150: 150, day_165: 165, day_178: 178, day_180: 180 },
      kpi_templates: { retail: { task_completion: { target_score: 4.0, weight: 0.25 } } },
    });
    renderWithProviders(<Settings />, { route: '/settings', user: testUser('admin') });

    expect(await screen.findByRole('heading', { name: 'System settings' })).toBeInTheDocument();
    expect(await screen.findByText('Article 296 deadline thresholds')).toBeInTheDocument();
    expect(await screen.findByText('Industry KPI template library')).toBeInTheDocument();
    expect(await screen.findByText('Retail')).toBeInTheDocument();
  });

  it('hides System settings from non-administrators', async () => {
    renderWithProviders(<Settings />, { route: '/settings', user: testUser('employer') });
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('heading', { name: 'System settings' })).not.toBeInTheDocument();
  });
});
