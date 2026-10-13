import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Rubrics from './Rubrics';
import { kpiApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const RUBRICS = [
  'task_completion',
  'quality_of_work',
  'attendance_and_punctuality',
  'communication_and_teamwork',
  'initiative_and_adaptability',
].map((competency) => ({ competency, target_score: 4.4, weight: 0.2 }));

const RETAIL_TEMPLATE = {
  task_completion: { target_score: 4.5, weight: 0.3 },
  quality_of_work: { target_score: 4.0, weight: 0.2 },
  attendance_and_punctuality: { target_score: 4.0, weight: 0.2 },
  communication_and_teamwork: { target_score: 4.0, weight: 0.15 },
  initiative_and_adaptability: { target_score: 4.0, weight: 0.15 },
};

beforeEach(() => localStorage.clear());

describe('Rubrics', () => {
  it('renders the five competency rubrics with targets from the API', async () => {
    kpiApi.list.mockResolvedValue(RUBRICS);
    renderWithProviders(<Rubrics />, { route: '/rubrics', user: testUser('employer') });
    expect(
      await screen.findByRole('heading', { name: 'KPI Performance Rubrics' })
    ).toBeInTheDocument();
    // Competency names come from config/domain (one source), not a local copy.
    expect((await screen.findAllByText('Task Completion')).length).toBeGreaterThan(0);
    // A rubric level descriptor renders in the matrix.
    expect(screen.getByText(/Exceeds output goals/)).toBeInTheDocument();
    // Target reflects the configured API value, not the 4.0 fallback literal.
    expect(await screen.findAllByText(/4\.4 \/ 5\.0/)).not.toHaveLength(0);
  });

  it('lets an employer apply an industry template and save the configuration atomically', async () => {
    kpiApi.list.mockResolvedValue(RUBRICS);
    kpiApi.templates.mockResolvedValue({ retail: RETAIL_TEMPLATE });
    kpiApi.saveAll.mockResolvedValue([]);
    renderWithProviders(<Rubrics />, { route: '/rubrics', user: testUser('employer') });

    expect(
      await screen.findByRole('heading', { name: 'KPI Configuration' })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Industry template'), { target: { value: 'retail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    // One atomic save carrying all five competencies (was five parallel PUTs).
    await waitFor(() => expect(kpiApi.saveAll).toHaveBeenCalledTimes(1));
    expect(kpiApi.update).not.toHaveBeenCalled();
    expect(kpiApi.saveAll).toHaveBeenCalledWith([
      { competency: 'task_completion', target_score: 4.5, weight: 0.3 },
      { competency: 'quality_of_work', target_score: 4.0, weight: 0.2 },
      { competency: 'attendance_and_punctuality', target_score: 4.0, weight: 0.2 },
      { competency: 'communication_and_teamwork', target_score: 4.0, weight: 0.15 },
      { competency: 'initiative_and_adaptability', target_score: 4.0, weight: 0.15 },
    ]);
  });

  it('shows the rubrics read-only for a supervisor (no configuration controls)', async () => {
    kpiApi.list.mockResolvedValue(RUBRICS);
    renderWithProviders(<Rubrics />, { route: '/rubrics', user: testUser('supervisor') });

    expect(
      await screen.findByRole('heading', { name: 'KPI Performance Rubrics' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'KPI Configuration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(kpiApi.templates).not.toHaveBeenCalled();
  });
});
