// UX / logic invariants that the existing suite does not assert.
//
// Each test encodes a rule that is true of ANY correct version of the screen,
// not of today's markup, so a fix can change the copy or layout and still pass.
// These tests render the real pages (jsdom) with the shared API mock.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import Rubrics from '../pages/supervisor/Rubrics';
import Dashboard from '../pages/employer/Dashboard';
import { employeeApi, interventionApi, kpiApi } from '../api';
import { renderWithProviders } from './renderWithProviders';
import { employee, plan, testUser } from './apiMock';
import { TONE_BG } from '../utils/status';

vi.mock('../api', async () => (await import('./apiMock')).createApiMock());

const COMPETENCY_KEYS = [
  'task_completion',
  'quality_of_work',
  'attendance_and_punctuality',
  'communication_and_teamwork',
  'initiative_and_adaptability',
];
const rubrics = (target, weights = [0.2, 0.2, 0.2, 0.2, 0.2]) =>
  COMPETENCY_KEYS.map((competency, i) => ({
    competency,
    target_score: target,
    weight: weights[i],
  }));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllEnvs());

// ---------------------------------------------------------------------------
// Rubrics page
// ---------------------------------------------------------------------------

// "1.0 - 2.9" (inclusive) or "3.0 – <4.0" (half-open) -> cents + exclusivity.
function parseBand(text) {
  const m = text.match(/(\d(?:\.\d+)?)\s*[-–]\s*(<)?\s*(\d(?:\.\d+)?)/);
  if (!m) return null;
  return {
    min: Math.round(parseFloat(m[1]) * 100),
    max: Math.round(parseFloat(m[3]) * 100),
    maxExclusive: Boolean(m[2]),
    text: m[0],
  };
}

async function renderRubricsBands(target = 4.0) {
  kpiApi.list.mockResolvedValue(rubrics(target));
  kpiApi.templates.mockResolvedValue({});
  renderWithProviders(<Rubrics />, { route: '/rubrics', user: testUser('employer') });
  const table = await screen.findByRole('table');
  const headers = within(table).getAllByRole('columnheader').slice(1); // skip "Competency"
  return headers.map((th) => ({ th, band: parseBand(th.textContent) }));
}

describe('Rubrics: score bands', () => {
  it('every possible score (1.00–5.00 at 0.01) falls in exactly one band', async () => {
    const cols = await renderRubricsBands();
    const bands = cols.map((c) => c.band);
    expect(bands.every(Boolean), 'every band header must contain a parsable range').toBe(true);

    const problems = [];
    for (let cents = 100; cents <= 500; cents += 1) {
      const hits = bands.filter(
        (b) => cents >= b.min && (b.maxExclusive ? cents < b.max : cents <= b.max)
      );
      if (hits.length !== 1) problems.push(`${(cents / 100).toFixed(2)} → ${hits.length} bands`);
    }
    expect(
      problems.slice(0, 8),
      `bands as printed: ${bands.map((b) => b.text).join(' | ')}. ` +
        'Weighted overall scores are 2-decimal (e.g. 4.34), so printed ranges must tile 1.0–5.0.'
    ).toEqual([]);
  });

  it('the band labelled "(target)" starts at the configured target', async () => {
    const cols = await renderRubricsBands(4.4); // employer raised the target to 4.4
    const targetCol = cols.find((c) => /\(target\)/i.test(c.th.textContent));
    // If the label was removed (valid fix), there is nothing to contradict.
    if (!targetCol) return;
    expect(
      targetCol.band.min,
      `header says "${targetCol.band.text} (target)" but the configured target is 4.4`
    ).toBe(440);
  });
});

describe('Rubrics: weights copy', () => {
  it('does not call weights "relative" while also demanding they total 100%', async () => {
    kpiApi.list.mockResolvedValue(rubrics(4.0, [0.3, 0.3, 0.3, 0.2, 0.2])); // totals 130%
    kpiApi.templates.mockResolvedValue({});
    renderWithProviders(<Rubrics />, { route: '/rubrics', user: testUser('employer') });
    await screen.findByRole('heading', { name: 'KPI Configuration' });

    const page = document.body.textContent;
    const saysRelative = /weights are relative/i.test(page);
    const demandsHundred = /should sum to 100%|must (?:sum|total) (?:to )?100%/i.test(page);
    expect(
      saysRelative && demandsHundred,
      'the backend normalizes by total weight (routers/evaluations.py), so pick one message'
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Employer dashboard
// ---------------------------------------------------------------------------

function renderDashboard() {
  return renderWithProviders(<Dashboard />, {
    route: '/dashboard',
    user: testUser('employer'),
  });
}

describe('Dashboard: status carries meaning', () => {
  beforeEach(() => {
    employeeApi.scanMilestones.mockResolvedValue({ fired: 0 });
    interventionApi.listPending.mockResolvedValue([]);
  });

  it('a zero "Past cap" count is not drawn in the bad (red) tone', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.list.mockResolvedValue([employee({ start_date: '2026-09-11' })]); // day 30
    renderDashboard();
    const label = await screen.findByText('Past cap');
    const dot = label.parentElement.querySelector('[aria-hidden="true"]');
    // No dot at all is a valid fix: a zero needs no status colour.
    if (!dot) return;
    expect(
      dot.className,
      'colour carries status (SLOP_AUDIT rule 8): nothing is past cap, so no red'
    ).not.toContain(TONE_BG.bad);
  });

  it('the "Past cap" figure follows the data (not a hardcoded number)', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    const pastCap = (id, name) =>
      employee({
        id,
        start_date: '2026-04-09', // day 185 on 2026-10-11
        user: { id: `u-${id}`, full_name: name, email: `${id}@acme.com` },
      });
    employeeApi.list.mockResolvedValue([pastCap('a', 'Alpha Past'), pastCap('b', 'Bravo Past')]);
    renderDashboard();
    const label = await screen.findByText('Past cap');
    const tile = label.closest('div.min-w-0');
    await waitFor(() => expect(within(tile).getByText('2')).toBeInTheDocument(), {
      timeout: 3000,
    });
  });
});

describe('Dashboard: every pending item is actionable', () => {
  it('a plan listed as "pending sign-off" has a control to act on it', async () => {
    vi.stubEnv('VITE_PERFORMA_TODAY', '2026-10-11');
    employeeApi.scanMilestones.mockResolvedValue({ fired: 0 });
    employeeApi.list.mockResolvedValue([employee({ start_date: '2026-05-04' })]);
    interventionApi.listPending.mockResolvedValue([plan()]);
    renderDashboard();

    const section = await screen.findByRole('region', { name: 'Interventions' });
    await within(section).findByText('SOP Workflow & Throughput Optimization');
    const controls = [
      ...within(section).queryAllByRole('link'),
      ...within(section).queryAllByRole('button'),
    ];
    expect(
      controls.length,
      'status "pending sign-off" needs a sign-off button or a link to where sign-off happens ' +
        '(the action lives on /rollups)'
    ).toBeGreaterThan(0);
  });
});
