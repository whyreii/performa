import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import RateEmployee from './RateEmployee';
import { employeeApi, evaluationApi, kpiApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const RUBRICS = [
  'task_completion',
  'quality_of_work',
  'attendance_and_punctuality',
  'communication_and_teamwork',
  'initiative_and_adaptability',
].map((competency) => ({ competency, target_score: 4.0, weight: 0.2 }));

function renderRate() {
  return renderWithProviders(
    <Routes>
      <Route path="/supervisor/rate" element={<RateEmployee />} />
    </Routes>,
    { route: '/supervisor/rate', user: testUser('supervisor') }
  );
}

beforeEach(() => {
  localStorage.clear();
  employeeApi.list.mockReset();
  evaluationApi.submitWeeklyRating.mockReset();
  kpiApi.list.mockResolvedValue(RUBRICS);
});

describe('RateEmployee', () => {
  it('shows an empty state when no reports are assigned', async () => {
    employeeApi.list.mockResolvedValue([]);
    renderRate();
    expect(await screen.findByText('No assigned probationary staff')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('requires meaningful remarks before opening the confirm dialog', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    renderRate();

    const remarks = await screen.findByLabelText(/Evidentiary Behavioral Remarks/);
    fireEvent.change(remarks, { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Evaluation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please provide meaningful behavioral remarks (at least 10 characters).'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(evaluationApi.submitWeeklyRating).not.toHaveBeenCalled();
  });

  it('records an evaluation only after the confirm step', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    evaluationApi.submitWeeklyRating.mockResolvedValue({
      overall_score: 4.0,
      evaluation_date: '2026-03-01',
    });
    renderRate();

    const remarks = await screen.findByLabelText(/Evidentiary Behavioral Remarks/);
    fireEvent.change(remarks, {
      target: { value: 'Consistently meets all assigned deadlines this week.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Evaluation' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Confirm Immutable Evaluation Submission')
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm & Record' }));

    expect(await screen.findByText('Evaluation Successfully Recorded')).toBeInTheDocument();
    expect(evaluationApi.submitWeeklyRating).toHaveBeenCalledTimes(1);
    const [empId, payload] = evaluationApi.submitWeeklyRating.mock.calls[0];
    expect(empId).toBe('e-1');
    expect(payload.remarks).toBe('Consistently meets all assigned deadlines this week.');
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining([
        'task_completion',
        'quality_of_work',
        'attendance_and_punctuality',
        'communication_and_teamwork',
        'initiative_and_adaptability',
      ])
    );
  });

  it('surfaces a submission error', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    evaluationApi.submitWeeklyRating.mockRejectedValue({
      response: { data: { detail: 'Employee is inactive' } },
    });
    renderRate();

    const remarks = await screen.findByLabelText(/Evidentiary Behavioral Remarks/);
    fireEvent.change(remarks, { target: { value: 'Adequately long remarks here.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Evaluation' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm & Record' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Employee is inactive');
  });
});
