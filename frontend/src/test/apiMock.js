import { vi } from 'vitest';

// Full stub of the src/api.js named exports. Use in a hoisted vi.mock:
//   vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());
// so every page (and AuthContext) gets deterministic, network-free mocks.
export function createApiMock() {
  return {
    authApi: {
      login: vi.fn(),
      register: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      getCurrentUser: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      updateProfile: vi.fn(),
    },
    employeeApi: {
      list: vi.fn(),
      scanMilestones: vi.fn(),
      listSupervisors: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      acknowledgeStandards: vi.fn(),
    },
    evaluationApi: {
      getTenantAuditTrail: vi.fn(),
      getAuditTrailCsv: vi.fn(),
      getScorecard: vi.fn(),
      getAuditTrail: vi.fn(),
      verifyAuditChain: vi.fn(),
      listWeekly: vi.fn(),
      submitWeeklyRating: vi.fn(),
      getRiskExplanation: vi.fn(),
      getTrend: vi.fn(),
      getRegularization: vi.fn(),
      generateRegularization: vi.fn(),
      getReportHtml: vi.fn(),
      getReportPdf: vi.fn(),
    },
    interventionApi: {
      listPending: vi.fn(),
      listMine: vi.fn(),
      signOff: vi.fn(),
      completePlan: vi.fn(),
      generateRollup: vi.fn(),
      listSummaries: vi.fn(),
      listMySummaries: vi.fn(),
      dispatchSummary: vi.fn(),
      acknowledgeSummary: vi.fn(),
    },
    notificationApi: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
    reportApi: { list: vi.fn(), generate: vi.fn(), downloadPdf: vi.fn() },
    adminApi: {
      listUsers: vi.fn(),
      listOrganizations: vi.fn(),
      createUser: vi.fn(),
      updateStatus: vi.fn(),
      resetPassword: vi.fn(),
      listActivity: vi.fn(),
      getSettings: vi.fn(),
      getReportsOverview: vi.fn(),
    },
    organizationApi: { update: vi.fn() },
    kpiApi: { list: vi.fn(), update: vi.fn(), saveAll: vi.fn(), history: vi.fn(), templates: vi.fn(), reset: vi.fn() },
    getApiErrorMessage: (error, fallback = 'An unexpected error occurred.') => {
      const detail = error?.response?.data?.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) return detail.map((d) => d?.msg).join(', ');
      return error?.message || fallback;
    },
    default: null,
  };
}

export const testUser = (role = 'employer', overrides = {}) => ({
  id: `u-${role}`,
  email: `${role}@acme.com`,
  full_name: 'Test User',
  role,
  organization_id: 'acme-ph',
  organization_name: 'Acme Philippines Corp.',
  is_active: true,
  ...overrides,
});

export const employee = (overrides = {}) => ({
  id: 'e-1',
  status: 'active',
  job_title: 'Analyst',
  department: 'Operations',
  start_date: '2026-01-01',
  day_180_date: '2026-06-30',
  supervisor_id: 'u-supervisor',
  user: { id: 'u-emp', full_name: 'Maria Midterm', email: 'emp1@acme.com' },
  employer: { id: 'u-employer', full_name: 'Test Employer' },
  supervisor: { id: 'u-supervisor', full_name: 'Test Supervisor' },
  ...overrides,
});

export const competencies = () => [
  { key: 'task_completion', label: 'Task Completion', score: 4.1, target: 4.0, gap: 0.1 },
  { key: 'quality_of_work', label: 'Quality of Work', score: 3.9, target: 4.0, gap: -0.1 },
  { key: 'attendance_and_punctuality', label: 'Attendance', score: 4.3, target: 4.0, gap: 0.3 },
  { key: 'communication_and_teamwork', label: 'Communication', score: 4.0, target: 4.0, gap: 0.0 },
  { key: 'initiative_and_adaptability', label: 'Initiative', score: 4.2, target: 4.0, gap: 0.2 },
];

export const scorecard = (overrides = {}) => ({
  employee_id: 'e-1',
  overall_score: 4.1,
  target_score: 4.0,
  gap: 0.1,
  latest_evaluation_date: '2026-03-01',
  competencies: competencies(),
  ...overrides,
});

export const auditRows = () => [
  {
    id: 'a-1',
    competency: 'task_completion',
    evaluator_name: 'Test Supervisor',
    employee_name: 'Maria Midterm',
    prior_score: null,
    new_score: 4.0,
    created_at: '2026-03-01T00:00:00+00:00',
  },
];

export const plan = (overrides = {}) => ({
  id: 'p-1',
  employee_id: 'e-1',
  competency: 'task_completion',
  catalog_id: 'TC-101',
  intervention_title: 'SOP Workflow & Throughput Optimization',
  intervention_type: 'on-the-job coaching',
  default_timeline: '2 weeks',
  rationale: 'Targets the throughput gap.',
  status: 'pending_approval',
  created_at: '2026-03-01T00:00:00+00:00',
  ...overrides,
});

export const summary = (overrides = {}) => ({
  id: 's-1',
  employee_id: 'e-1',
  month_number: 2,
  avg_task_completion: 4.1,
  avg_attendance: 4.2,
  avg_communication: 4.0,
  avg_initiative: 4.3,
  avg_quality: 4.2,
  overall_average: 4.0,
  status_classification: 'Meets Expectations',
  performance_summary: 'Consistent performer.',
  dispatched_at: null,
  acknowledged_at: null,
  ...overrides,
});
