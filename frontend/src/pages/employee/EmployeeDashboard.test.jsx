import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import EmployeeDashboard from './EmployeeDashboard';
import { employeeApi, evaluationApi, interventionApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, auditRows, scorecard, summary, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const emp = testUser('probationary_employee');
const myProfile = employee({
  user: { id: 'u-emp', full_name: 'Test User', email: emp.email },
});

function renderDashboard() {
  return renderWithProviders(<EmployeeDashboard />, {
    route: '/employee/dashboard',
    user: emp,
  });
}

function primeEmpty() {
  evaluationApi.getAuditTrail.mockResolvedValue([]);
  interventionApi.listMySummaries.mockResolvedValue([]);
  interventionApi.listMine.mockResolvedValue([]);
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllEnvs());

describe('EmployeeDashboard', () => {
  it('renders the employee-first account (checklist, months, standing)', async () => {
    employeeApi.list.mockResolvedValue([myProfile]);
    evaluationApi.getAuditTrail.mockResolvedValue(auditRows());
    evaluationApi.getScorecard.mockResolvedValue(scorecard());
    evaluationApi.getTrend.mockResolvedValue([]);
    interventionApi.listMySummaries.mockResolvedValue([]);
    interventionApi.listMine.mockResolvedValue([]);
    evaluationApi.listWeekly.mockResolvedValue([
      {
        id: 'w-1',
        evaluation_date: '2026-03-01',
        week_number: 1,
        evaluator_name: 'Supervisor Juan',
        overall_score: 4,
        remarks: 'Great progress this week.',
      },
    ]);
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'My Performance Scorecard' })
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Your checklist' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Month by month' })).toBeInTheDocument();
    expect(screen.getByText('Month 5')).toBeInTheDocument();
    expect(screen.getByText('You are here')).toBeInTheDocument();
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
    expect(await screen.findByText('Great progress this week.')).toBeInTheDocument();
    expect(screen.queryByText('Day 165 · Notice')).not.toBeInTheDocument();
  });

  it('hides the live month marker for a regularized employee', async () => {
    employeeApi.list.mockResolvedValue([{ ...myProfile, status: 'regularized' }]);
    evaluationApi.getAuditTrail.mockResolvedValue([]);
    interventionApi.listMySummaries.mockResolvedValue([]);
    interventionApi.listMine.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Month by month' })).toBeInTheDocument();
    expect(screen.queryByText('You are here')).not.toBeInTheDocument();
  });

  it('acknowledges a shared monthly summary', async () => {
    employeeApi.list.mockResolvedValue([myProfile]);
    evaluationApi.getAuditTrail.mockResolvedValue([]);
    interventionApi.listMySummaries.mockResolvedValue([summary({ acknowledged_at: null })]);
    interventionApi.listMine.mockResolvedValue([]);
    interventionApi.acknowledgeSummary.mockResolvedValue({});
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));
    await waitFor(() =>
      expect(interventionApi.acknowledgeSummary).toHaveBeenCalledWith('s-1')
    );
    expect(await screen.findByText('Consistent performer.')).toBeInTheDocument();
  });

  it('surfaces a retryable error when the profile fetch fails', async () => {
    employeeApi.list.mockRejectedValue(new Error('down'));
    renderDashboard();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText('down')).toBeInTheDocument();
  });

  it('counts down to the Day 150 review, not the Day 180 cap', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([{ ...myProfile, start_date: '2026-09-04' }]);
    primeEmpty();
    renderDashboard();
    expect(await screen.findByText(/113 days to your review/)).toBeInTheDocument();
  });

  it('switches to the Day 180 cap once the review has passed', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([{ ...myProfile, start_date: '2026-04-20' }]);
    primeEmpty();
    renderDashboard();
    expect(await screen.findByText(/6 days until the 180-day cap/)).toBeInTheDocument();
  });

  it('reports a past-cap record plainly', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([{ ...myProfile, start_date: '2026-03-01' }]);
    primeEmpty();
    renderDashboard();
    expect(await screen.findByText(/past the 180-day cap/i)).toBeInTheDocument();
  });
});
