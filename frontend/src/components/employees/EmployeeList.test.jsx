import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import EmployeeList from './EmployeeList';
import { employeeApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderList() {
  return renderWithProviders(<EmployeeList />, {
    route: '/employees',
    user: testUser('employer'),
  });
}

beforeEach(() => localStorage.clear());

describe('EmployeeList', () => {
  it('renders each employee as a navigable link', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    renderList();
    const link = await screen.findByRole('link', { name: 'Maria Midterm' });
    expect(link).toHaveAttribute('href', '/employees/e-1');
  });

  it('shows an empty state when nothing matches', async () => {
    employeeApi.list.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText('No employees match')).toBeInTheDocument();
  });

  it('surfaces the load error', async () => {
    employeeApi.list.mockRejectedValue(new Error('down'));
    renderList();
    expect(await screen.findByText('down')).toBeInTheDocument();
  });
});
