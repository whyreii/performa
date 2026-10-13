import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Reports from './Reports';
import { employeeApi, reportApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const RECORDED = {
  id: 'r-1',
  employee_id: 'e-1',
  employee_name: 'Maria Midterm',
  report_type: 'performance',
  title: 'Performance Evaluation Report (Article 296)',
  size_bytes: 2048,
  generated_by_name: 'Test Employer',
  created_at: '2026-03-01T00:00:00+00:00',
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Reports', () => {
  it('lists recorded reports and generates one on demand', async () => {
    reportApi.list.mockResolvedValue([RECORDED]);
    employeeApi.list.mockResolvedValue([employee()]);
    reportApi.generate.mockResolvedValue({ ...RECORDED, id: 'r-2' });
    reportApi.downloadPdf.mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();

    renderWithProviders(<Reports />, { route: '/reports', user: testUser('employer') });

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    // The recorded report is listed.
    expect(await screen.findByText('Maria Midterm')).toBeInTheDocument();

    // Generate a new one from the toolbar modal, then it downloads.
    fireEvent.click(screen.getByRole('button', { name: /Generate report/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Generate & download/i }));

    await waitFor(() => expect(reportApi.generate).toHaveBeenCalled());
    expect(reportApi.generate.mock.calls[0][0]).toBe('e-1');
    await waitFor(() => expect(reportApi.downloadPdf).toHaveBeenCalledWith('r-2'));
  });
});
