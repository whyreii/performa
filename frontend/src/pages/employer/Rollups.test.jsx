import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import Rollups from './Rollups';
import { employeeApi, interventionApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, plan, summary, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderRollups() {
  return renderWithProviders(
    <Routes>
      <Route path="/rollups" element={<Rollups />} />
    </Routes>,
    { route: '/rollups', user: testUser('employer') }
  );
}

beforeEach(() => {
  localStorage.clear();
  employeeApi.list.mockResolvedValue([employee()]);
  interventionApi.listSummaries.mockResolvedValue([summary()]);
  interventionApi.listPending.mockReset();
  interventionApi.signOff.mockReset();
});

describe('Rollups', () => {
  it('shows an empty state when there are no pending plans', async () => {
    interventionApi.listPending.mockResolvedValue([]);
    renderRollups();
    expect(await screen.findByText('No pending intervention approvals')).toBeInTheDocument();
  });

  it('requires explicit confirmation before signing off a plan', async () => {
    interventionApi.listPending.mockResolvedValue([plan()]);
    interventionApi.signOff.mockResolvedValue({});
    renderRollups();

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(interventionApi.signOff).toHaveBeenCalledWith('p-1', true));
  });

  it('shows an error with a working Retry', async () => {
    interventionApi.listPending.mockRejectedValue(new Error('down'));
    renderRollups();

    expect(await screen.findByText('Failed to load pending plans')).toBeInTheDocument();
    const callsBefore = interventionApi.listPending.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(interventionApi.listPending.mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it('labels the 30-day evaluation months by their true day range (Day-0 convention)', async () => {
    interventionApi.listPending.mockResolvedValue([]);
    renderRollups();
    fireEvent.click(await screen.findByRole('button', { name: /Generate Rollup/i }));
    expect(await screen.findByText('Month 1 · Days 0-29')).toBeInTheDocument();
  });
});
