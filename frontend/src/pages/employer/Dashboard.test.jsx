import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Dashboard', () => {
  it('renders the probationary worklist', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
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
});
