import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import EmployeeDetail from './EmployeeDetail';
import { employeeApi, evaluationApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, auditRows, scorecard, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/:id" element={<EmployeeDetail />} />
    </Routes>,
    { route: '/employees/e-1', user: testUser('employer') }
  );
}

function primeHappyPath() {
  employeeApi.getById.mockResolvedValue(employee());
  evaluationApi.getAuditTrail.mockResolvedValue(auditRows());
  evaluationApi.getScorecard.mockResolvedValue(scorecard());
  evaluationApi.getTrend.mockResolvedValue([]);
  evaluationApi.getRiskExplanation.mockResolvedValue({
    predicted_tier: 'Meets Expectations',
    confidence: 0.9,
    probabilities: {},
    feature_importances: { task_completion: 0.5 },
    flagged_competencies: [],
    shap_values: {},
    shap_base_value: 0.1,
    shap_target_class: 'Meets Expectations',
    shap_risk_polarity: 'safe',
    permutation_importances: {},
    explanation_method: 'Exact Shapley',
  });
  evaluationApi.getRegularization.mockRejectedValue({ response: { status: 404 } });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('EmployeeDetail', () => {
  it('shows Retry — never "no evaluations" — when the audit fetch fails', async () => {
    employeeApi.getById.mockResolvedValue(employee());
    evaluationApi.getAuditTrail.mockRejectedValue(new Error('down'));
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('No evaluations yet')).not.toBeInTheDocument();

    const callsBefore = evaluationApi.getAuditTrail.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(evaluationApi.getAuditTrail.mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it('renders the scorecard and the ML feature-importance panel', async () => {
    primeHappyPath();
    renderDetail();
    expect(
      await screen.findByText(/Feature importance for legal defensibility/)
    ).toBeInTheDocument();
  });

  it('opens the status transition dialog', async () => {
    primeHappyPath();
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: /Update Status/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
