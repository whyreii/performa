import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import EmployeeDashboard from './EmployeeDashboard';
import { employeeApi, evaluationApi, interventionApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, auditRows, scorecard, testUser } from '../../test/apiMock';

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
  it('renders the self-scoped scorecard', async () => {
    employeeApi.list.mockResolvedValue([myProfile]);
    evaluationApi.getAuditTrail.mockResolvedValue(auditRows());
    evaluationApi.getScorecard.mockResolvedValue(scorecard());
    interventionApi.listMySummaries.mockResolvedValue([]);
    renderDashboard();
    expect(
      await screen.findByRole('heading', { name: 'My Performance Scorecard' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Probationary Period Timeline')).toBeInTheDocument();
  });

  it('surfaces a retryable error when the profile fetch fails', async () => {
    employeeApi.list.mockRejectedValue(new Error('down'));
    renderDashboard();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText('down')).toBeInTheDocument();
  });
});
