import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Reports from './Reports';
import { employeeApi, evaluationApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Reports', () => {
  it('lists employees and generates a report on demand', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    evaluationApi.getReportHtml.mockResolvedValue('<html></html>');
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({});

    renderWithProviders(<Reports />, { route: '/reports', user: testUser('employer') });

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(await screen.findByText('Maria Midterm')).toBeInTheDocument();

    // One path to generate: the row's action (no separate selector form).
    fireEvent.click(screen.getByRole('button', { name: 'Open report' }));

    await waitFor(() => expect(evaluationApi.getReportHtml).toHaveBeenCalledWith('e-1'));
  });
});
