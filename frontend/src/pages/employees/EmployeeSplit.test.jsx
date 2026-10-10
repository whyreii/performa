import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import EmployeeSplit from './EmployeeSplit';
import { employeeApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

beforeEach(() => {
  localStorage.clear();
  employeeApi.list.mockResolvedValue([employee()]);
  employeeApi.listSupervisors.mockResolvedValue([
    { id: 's-1', full_name: 'Sue Supervisor', email: 'sup@acme.com' },
  ]);
});

describe('EmployeeSplit', () => {
  it('renders the directory and opens the onboarding modal for employers', async () => {
    renderWithProviders(<EmployeeSplit />, {
      route: '/employees',
      user: testUser('employer'),
    });
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(await screen.findByText('Maria Midterm')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add employee' }));
    expect(await screen.findByText('Onboard Probationary Employee')).toBeInTheDocument();
  });

  it('hides the onboarding action for non-employers', async () => {
    renderWithProviders(<EmployeeSplit />, {
      route: '/employees',
      user: testUser('supervisor'),
    });
    await screen.findByRole('heading', { name: 'Employees' });
    expect(screen.queryByRole('button', { name: 'Add employee' })).not.toBeInTheDocument();
  });
});
