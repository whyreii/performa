// UX / logic invariants the existing suites do not assert (round 2).
//
// Each test encodes a rule that is true of ANY correct version of the screen,
// not of today's markup, so a fix can change the copy or layout and still pass.
// These tests render the real pages (jsdom) with the shared API mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import EmployeeDetail from '../pages/employees/EmployeeDetail';
import EmployeeDashboard from '../pages/employee/EmployeeDashboard';
import Rollups from '../pages/employer/Rollups';
import { employeeApi, evaluationApi, interventionApi } from '../api';
import { renderWithProviders } from './renderWithProviders';
import { employee, auditRows, scorecard, plan, testUser } from './apiMock';
import { COMPETENCIES } from '../config/domain';

vi.mock('../api', async () => (await import('./apiMock')).createApiMock());

const EMP = testUser('probationary_employee');
const MY_PROFILE = employee({
  user: { id: 'u-emp', full_name: 'Test User', email: EMP.email },
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// (a) the score key tiles 1.0–5.0 with no gap or overlap at 0.01 resolution
// Same parse approach as ux-invariants.test.jsx: a printed range is
// "<a> – <b>" / "<a> - <b>" / "<a> – <b" with an optional exclusive marker.
// ---------------------------------------------------------------------------
function scoreKeyBands() {
  const p = [...document.querySelectorAll('p')].find((el) => /Score key/i.test(el.textContent));
  if (!p) return null;
  return [...p.textContent.matchAll(/(\d(?:\.\d+)?)\s*[-–]\s*(<)?\s*(\d(?:\.\d+)?)/g)].map(
    (m) => ({
      min: Math.round(parseFloat(m[1]) * 100),
      max: Math.round(parseFloat(m[3]) * 100),
      maxExclusive: Boolean(m[2]),
      text: m[0],
    })
  );
}

function expectTiles(bands) {
  expect(bands, 'the score key must print parsable ranges').toBeTruthy();
  expect(bands.length, 'the score key must print at least one range').toBeGreaterThan(0);
  const problems = [];
  for (let cents = 100; cents <= 500; cents += 1) {
    const hits = bands.filter(
      (b) => cents >= b.min && (b.maxExclusive ? cents < b.max : cents <= b.max)
    );
    if (hits.length !== 1) problems.push(`${(cents / 100).toFixed(2)} → ${hits.length} bands`);
  }
  expect(
    problems.slice(0, 8),
    `bands as printed: ${bands.map((b) => b.text).join(' | ')}`
  ).toEqual([]);
}

describe('Score key tiles the whole 1.0–5.0 scale', () => {
  it('EmployeeDetail', async () => {
    employeeApi.getById.mockResolvedValue(employee({ status: 'active' }));
    evaluationApi.getAuditTrail.mockResolvedValue(auditRows());
    evaluationApi.getScorecard.mockResolvedValue(scorecard());
    evaluationApi.getTrend.mockResolvedValue([]);
    evaluationApi.getRegularization.mockRejectedValue({ response: { status: 404 } });
    evaluationApi.listWeekly.mockResolvedValue([]);
    evaluationApi.getRiskExplanation.mockResolvedValue({
      predicted_tier: 'Meets Expectations',
      confidence: 0.9,
      probabilities: {},
      feature_importances: {},
      flagged_competencies: [],
      shap_values: {},
      shap_base_value: 0,
      shap_target_class: 'Meets Expectations',
      shap_risk_polarity: 'safe',
    });

    renderWithProviders(
      <Routes>
        <Route path="/employees/:id" element={<EmployeeDetail />} />
      </Routes>,
      { route: '/employees/e-1', user: testUser('employer') }
    );

    await screen.findByRole('heading', { name: 'Competency standing' });
    await waitFor(() => expect(scoreKeyBands()).toBeTruthy());
    expectTiles(scoreKeyBands());
  });

  it('EmployeeDashboard', async () => {
    employeeApi.list.mockResolvedValue([MY_PROFILE]);
    // The scorecard query is gated on the audit trail being non-empty.
    evaluationApi.getAuditTrail.mockResolvedValue(auditRows());
    evaluationApi.getScorecard.mockResolvedValue(scorecard());
    evaluationApi.getTrend.mockResolvedValue([]);
    interventionApi.listMySummaries.mockResolvedValue([]);
    interventionApi.listMine.mockResolvedValue([]);

    renderWithProviders(<EmployeeDashboard />, {
      route: '/employee/dashboard',
      user: EMP,
    });

    await screen.findByRole('heading', { name: 'My Performance Scorecard' });
    await waitFor(() => expect(scoreKeyBands()).toBeTruthy());
    expectTiles(scoreKeyBands());
  });
});

// ---------------------------------------------------------------------------
// (b) pending approvals are decided with the employee and the rationale visible
// ---------------------------------------------------------------------------
describe('Pending approvals show the employee and put the rationale first', () => {
  it('Rollups', async () => {
    employeeApi.list.mockResolvedValue([employee()]);
    interventionApi.listPending.mockResolvedValue([plan()]);
    interventionApi.listSummaries.mockResolvedValue([]);

    renderWithProviders(
      <Routes>
        <Route path="/rollups" element={<Rollups />} />
      </Routes>,
      { route: '/rollups', user: testUser('employer') }
    );

    const section = await screen.findByRole('region', { name: 'Pending approvals' });
    const titleEl = await within(section).findByText('SOP Workflow & Throughput Optimization');
    const approve = await within(section).findByRole('button', { name: /^Approve / });

    // The employee the plan targets must be visible on the same card as the
    // title and the decision controls (walk up to the nearest shared ancestor).
    let card = titleEl;
    while (card && !card.contains(approve)) card = card.parentElement;
    expect(card?.textContent, 'the card must name the employee the plan targets').toContain(
      'Maria Midterm'
    );

    // The rationale reads before the decision buttons in DOM order.
    const rationale = await within(section).findByText('Targets the throughput gap.');
    expect(
      rationale.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the rationale must come before the Approve/Reject controls'
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// (c) the scorecard shows at least one rating change per competency initially
// ---------------------------------------------------------------------------
describe('Recent rating changes are not cut in half', () => {
  it('shows at least one audit row per competency on first render', async () => {
    employeeApi.list.mockResolvedValue([MY_PROFILE]);
    evaluationApi.getAuditTrail.mockResolvedValue(
      COMPETENCIES.map((c, i) => ({
        id: `a-${i}`,
        competency: c.key,
        evaluator_name: 'Supervisor Juan',
        prior_score: null,
        new_score: 4.0 + i * 0.1,
        created_at: '2026-03-01T00:00:00+00:00',
      }))
    );
    evaluationApi.getScorecard.mockResolvedValue(scorecard());
    evaluationApi.getTrend.mockResolvedValue([]);
    interventionApi.listMySummaries.mockResolvedValue([]);
    interventionApi.listMine.mockResolvedValue([]);

    renderWithProviders(<EmployeeDashboard />, {
      route: '/employee/dashboard',
      user: EMP,
    });

    const heading = await screen.findByRole('heading', { name: 'Recent rating changes' });
    const section = heading.closest('section');
    await waitFor(() =>
      expect(section.querySelectorAll('ul > li').length).toBeGreaterThanOrEqual(
        COMPETENCIES.length
      )
    );
  });
});

// (d) "standards/targets never print two decimals" is intentionally NOT
// asserted: the same files render the exported report text ("Mandatory
// Regularizing Benchmark 4.00 / 5.00") which the owner requires to stay
// 2-decimal, so a page-wide assertion would contradict that rule.
