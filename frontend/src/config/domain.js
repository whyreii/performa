// Shared domain constants (mirror the backend; backend remains the source of truth).

export const PROBATION_DAYS = 180;

// Article 296 regularizing standard: an immutable 4.0/5.0 floor. Employers may
// set higher per-competency targets via /api/kpi-rubrics, but never lower.
export const TARGET = 4.0;

// Article 296 statutory milestone thresholds.
export const MILESTONE_REVIEW = 150;
export const MILESTONE_NOTICE = 165;
export const MILESTONE_CRITICAL = 178;
export const MILESTONES = [MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL];

export const COMPETENCIES = [
  { key: 'task_completion', label: 'Task Completion' },
  { key: 'quality_of_work', label: 'Quality of Work' },
  { key: 'attendance_and_punctuality', label: 'Attendance & Punctuality' },
  { key: 'communication_and_teamwork', label: 'Communication & Teamwork' },
  { key: 'initiative_and_adaptability', label: 'Initiative & Adaptability' },
];
