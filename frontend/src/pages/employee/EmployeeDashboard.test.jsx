import { describe, it, expect, vi, beforeEach } from 'vitest';
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

beforeEach(() => localStorage.clear());

describe('EmployeeDashboard', () => {
  it('renders the employee-first account (checklist, months, standing)', async () => {
    employeeApi.list.mockResolvedValue([myProfile]);
    evaluationApi.getAuditTrail.mockResolvedValue(auditRows());
    evaluationApi.getScorecard.mockResolvedValue(scorecard());
    evaluationApi.getTrend.mockResolvedValue([]);
    interventionApi.listMySummaries.mockResolvedValue([]);
    interventionApi.listMine.mockResolvedValue([]);
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'My Performance Scorecard' })
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Your checklist' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Month by month' })).toBeInTheDocument();
    expect(screen.getByText('Month 5')).toBeInTheDocument();
    expect(screen.getByText('You are here')).toBeInTheDocument();
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
    expect(screen.queryByText('Day 165 · Notice')).not.toBeInTheDocument();
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
  });

  it('surfaces a retryable error when the profile fetch fails', async () => {
    employeeApi.list.mockRejectedValue(new Error('down'));
    renderDashboard();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText('down')).toBeInTheDocument();
  });
});
