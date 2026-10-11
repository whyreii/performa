import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { employeeApi, interventionApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, plan, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderDashboard() {
  return renderWithProviders(<Dashboard />, { route: '/dashboard', user: testUser('employer') });
}

beforeEach(() => {
  localStorage.clear();
  employeeApi.scanMilestones.mockResolvedValue({ fired: 0 });
});

afterEach(() => vi.unstubAllEnvs());

describe('Dashboard', () => {
  it('renders the probationary worklist', async () => {
    // Stub today so the day-160 employee falls inside the action window.
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([employee({ start_date: '2026-05-04' })]);
    interventionApi.listPending.mockResolvedValue([plan()]);
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Maria Midterm')).toBeInTheDocument();
  });

  it('surfaces an error when AI recommendations fail to load', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    interventionApi.listPending.mockRejectedValue(new Error('down'));
    renderDashboard();
    expect(
      await screen.findByText('Unable to load AI recommendations right now. Please retry.')
    ).toBeInTheDocument();
  });

  it('defaults the action list to the Day 150-180 window (matches the Decisions-due KPI)', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([
      employee({ id: 'e-due', start_date: '2026-05-04', user: { id: 'u1', full_name: 'Due Person', email: 'due@acme.com' } }),
      employee({ id: 'e-on', start_date: '2026-09-11', user: { id: 'u2', full_name: 'On Track Person', email: 'on@acme.com' } }),
      employee({ id: 'e-past', start_date: '2026-04-09', user: { id: 'u3', full_name: 'Past Cap Person', email: 'past@acme.com' } }),
    ]);
    interventionApi.listPending.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByText('Due Person')).toBeInTheDocument();
    expect(screen.queryByText('On Track Person')).not.toBeInTheDocument();
    expect(screen.queryByText('Past Cap Person')).not.toBeInTheDocument();
    expect(screen.getByText(/1 probationary employee/)).toBeInTheDocument();
  });

  it('shows days remaining to the next milestone in the Deadline column', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([
      employee({ id: 'e-due', start_date: '2026-05-04', user: { id: 'u1', full_name: 'Due Person', email: 'due@acme.com' } }),
    ]);
    interventionApi.listPending.mockResolvedValue([]);
    renderDashboard();
    // Day 160 → next milestone is Day 165, 5 days away (not the elapsed "Day 160").
    expect(await screen.findByText('5d')).toBeInTheDocument();
  });

  it('labels the past-cap tile as Past Day 180, matching the >180 rule', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([
      employee({ id: 'e-past', start_date: '2026-04-09', user: { id: 'u3', full_name: 'Past Cap Person', email: 'past@acme.com' } }),
    ]);
    interventionApi.listPending.mockResolvedValue([]);
    renderDashboard();
    expect(await screen.findByText(/Past Day 180/)).toBeInTheDocument();
    expect(screen.queryByText(/Day 180\+/)).not.toBeInTheDocument();
  });
});
