import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import EmployeeTraining from './EmployeeTraining';
import { interventionApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { plan, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderTraining() {
  return renderWithProviders(<EmployeeTraining />, {
    route: '/employee/training',
    user: testUser('probationary_employee'),
  });
}

beforeEach(() => localStorage.clear());

describe('EmployeeTraining', () => {
  it('lists assigned interventions with their status', async () => {
    interventionApi.listMine.mockResolvedValue([plan({ status: 'approved' })]);
    renderTraining();
    expect(
      await screen.findByRole('heading', { name: 'Assigned Training Interventions' })
    ).toBeInTheDocument();
    expect(await screen.findByText('SOP Workflow & Throughput Optimization')).toBeInTheDocument();
    expect(screen.getByText('Active Assignment')).toBeInTheDocument();
  });

  it('shows the empty state when none are assigned', async () => {
    interventionApi.listMine.mockResolvedValue([]);
    renderTraining();
    expect(await screen.findByText('No required training interventions')).toBeInTheDocument();
  });

  it('lets the employee mark an approved intervention complete', async () => {
    interventionApi.listMine.mockResolvedValue([plan({ status: 'approved' })]);
    interventionApi.completePlan.mockResolvedValue({});
    renderTraining();

    fireEvent.click(await screen.findByRole('button', { name: /Mark complete/i }));
    await waitFor(() => expect(interventionApi.completePlan).toHaveBeenCalledWith('p-1'));
  });

  it('shows a Completed badge and no action for a completed plan', async () => {
    interventionApi.listMine.mockResolvedValue([plan({ status: 'completed' })]);
    renderTraining();
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark complete/i })).not.toBeInTheDocument();
  });
});
