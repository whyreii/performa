import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AddEmployeeModal from './AddEmployeeModal';
import { employeeApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const SUPERVISOR = { id: 's-1', full_name: 'Sue Supervisor', email: 'sup@acme.com' };

function renderModal(onClose = () => {}) {
  return renderWithProviders(
    <AddEmployeeModal isOpen onClose={onClose} />,
    { route: '/employees', user: testUser('employer') }
  );
}

beforeEach(() => {
  localStorage.clear();
  employeeApi.listSupervisors.mockReset();
  employeeApi.create.mockReset();
});

describe('AddEmployeeModal', () => {
  it('requires all mandatory fields', async () => {
    employeeApi.listSupervisors.mockResolvedValue([SUPERVISOR]);
    const { container } = renderModal();
    await screen.findByText('Onboard Probationary Employee');

    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByText('Please fill in all required fields.')).toBeInTheDocument();
    expect(employeeApi.create).not.toHaveBeenCalled();
  });

  it('creates the employee with the assigned supervisor on success', async () => {
    employeeApi.listSupervisors.mockResolvedValue([SUPERVISOR]);
    employeeApi.create.mockResolvedValue({ id: 'e-9' });
    const onClose = vi.fn();
    const { container } = renderModal(onClose);
    await screen.findByText('Onboard Probationary Employee');

    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Nina New' } });
    fireEvent.change(screen.getByLabelText(/Work Email/), { target: { value: 'nina@acme.com' } });
    fireEvent.change(screen.getByLabelText(/Job Title/), { target: { value: 'Analyst' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(employeeApi.create).toHaveBeenCalledTimes(1));
    expect(employeeApi.create.mock.calls[0][0]).toMatchObject({
      full_name: 'Nina New',
      email: 'nina@acme.com',
      job_title: 'Analyst',
      supervisor_id: 's-1',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
