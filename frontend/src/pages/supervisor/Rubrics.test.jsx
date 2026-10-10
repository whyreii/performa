import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
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

beforeEach(() => localStorage.clear());

describe('Rubrics', () => {
  it('renders the five competency rubrics with targets from the API', async () => {
    kpiApi.list.mockResolvedValue(RUBRICS);
    renderWithProviders(<Rubrics />, { route: '/supervisor/rubrics', user: testUser('employer') });
    expect(
      await screen.findByRole('heading', { name: 'KPI Performance Rubrics' })
    ).toBeInTheDocument();
    expect(await screen.findByText('1. Task Completion & Work Output')).toBeInTheDocument();
    // Target reflects the configured API value, not the 4.0 fallback literal.
    expect(await screen.findAllByText(/4\.4 \/ 5\.0/)).not.toHaveLength(0);
  });
});
