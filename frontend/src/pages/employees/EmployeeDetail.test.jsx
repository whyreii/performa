import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import EmployeeDetail from './EmployeeDetail';
import { employeeApi, evaluationApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { employee, auditRows, scorecard, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

function renderDetail(role = 'employer') {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/:id" element={<EmployeeDetail />} />
    </Routes>,
    { route: '/employees/e-1', user: testUser(role) }
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
  evaluationApi.listWeekly.mockResolvedValue([
    {
      id: 'w-1',
      evaluation_date: '2026-03-01',
      week_number: 1,
      evaluator_name: 'Supervisor Juan',
      overall_score: 4,
      remarks: 'Consistently strong delivery and clear communication.',
    },
  ]);
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

  it('shows the supervisor’s behavioral remarks', async () => {
    primeHappyPath();
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Supervisor remarks' })).toBeInTheDocument();
    expect(
      await screen.findByText('Consistently strong delivery and clear communication.')
    ).toBeInTheDocument();
  });

  it('shows the non-regularization reason when the employee is terminated', async () => {
    primeHappyPath();
    employeeApi.getById.mockResolvedValue(
      employee({
        status: 'terminated',
        status_reason: 'Repeated failure to meet quality standards.',
      })
    );
    renderDetail();
    expect(await screen.findByText('Non-regularization reason:')).toBeInTheDocument();
    expect(
      await screen.findByText('Repeated failure to meet quality standards.')
    ).toBeInTheDocument();
  });

  it('shows the final decision, not the AI recommendation, once regularized', async () => {
    primeHappyPath();
    employeeApi.getById.mockResolvedValue(employee({ status: 'regularized' }));
    evaluationApi.getRegularization.mockResolvedValue({
      recommendation: 'Do Not Regularize',
      status_classification: 'Needs Improvement',
      overall_average: 2.8,
      rationale: 'Below standard across competencies.',
    });
    renderDetail();

    expect(
      await screen.findByText('Final decision recorded: conferring regular status.')
    ).toBeInTheDocument();
    // The AI artifact is demoted and clearly labelled as pre-decision.
    expect(
      await screen.findByText(/AI recommendation generated before this decision:/)
    ).toBeInTheDocument();
    expect(screen.getByText('Do Not Regularize')).toBeInTheDocument();
    // No live milestone clock, and no regenerate control on a terminal record.
    expect(screen.getByText('Final record')).toBeInTheDocument();
    expect(screen.getByText(/· final record/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate|Regenerate/ })).not.toBeInTheDocument();
  });

  it('verifies the tamper-evident audit chain on demand', async () => {
    primeHappyPath();
    evaluationApi.verifyAuditChain.mockResolvedValue({
      valid: true,
      checked: 12,
      first_broken_id: null,
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Verify integrity' }));
    expect(await screen.findByText('Chain verified · 12')).toBeInTheDocument();
    expect(evaluationApi.verifyAuditChain).toHaveBeenCalledWith('e-1');
  });

  it('hides the recommendation and ML panel from the employee (self view)', async () => {
    primeHappyPath();
    renderDetail('probationary_employee');

    expect(
      await screen.findByRole('heading', { name: 'Competency standing' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recommendation' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'ML Risk Explanation' })
    ).not.toBeInTheDocument();
  });

  it('supervisor lens leads with "This week\'s rating" and hides the AI panel', async () => {
    primeHappyPath();
    renderDetail('supervisor');

    expect(
      await screen.findByRole('heading', { name: "This week's rating" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'ML Risk Explanation' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update Status/i })).not.toBeInTheDocument();
  });
});
