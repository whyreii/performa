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

    fireEvent.click(await screen.findByRole('button', { name: /^Approve / }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(interventionApi.signOff).toHaveBeenCalledWith('p-1', true));
  });

  it('reads the rationale before deciding, and prints the average to two decimals', async () => {
    // Link the plan to the summary so the card renders its evidence line.
    interventionApi.listPending.mockResolvedValue([plan({ monthly_summary_id: 's-1' })]);
    renderRollups();

    const rationale = await screen.findByText('Targets the throughput gap.');
    const approve = await screen.findByRole('button', { name: /^Approve / });

    // D8: the reason is read before the decision is taken.
    expect(
      rationale.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the rationale must come before the Approve control'
    ).toBeTruthy();
    // …and the controls are their own row, not beside the rationale text.
    expect(
      rationale.parentElement.contains(approve),
      'the decision controls must sit below the rationale block'
    ).toBe(false);

    // D6: a computed average prints two decimals, matching the summary table.
    expect(await screen.findByText(/Avg \d+\.\d{2} ·/)).toHaveTextContent('Avg 4.10');
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
