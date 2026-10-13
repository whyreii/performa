import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import SupervisorDashboard from './SupervisorDashboard';
import { employeeApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

beforeEach(() => localStorage.clear());

describe('SupervisorDashboard', () => {
  it('renders assigned reports and the statutory policy cards', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    renderWithProviders(<SupervisorDashboard />, {
      route: '/supervisor/dashboard',
      user: testUser('supervisor'),
    });
    expect(
      await screen.findByRole('heading', { name: 'My Direct Reports' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Maria Midterm')).toBeInTheDocument();
    // Policy value comes from the shared TARGET constant, not a literal.
    expect(screen.getByText(/Regularizing standard 4\.0 \/ 5\.0/)).toBeInTheDocument();
  });
});
