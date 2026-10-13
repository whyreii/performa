// Shared domain constants (mirror the backend; backend remains the source of truth).

export const PROBATION_DAYS = 180;

// Probation month length (mirrors backend domain.PROBATION_MONTH_DAYS).
export const PROBATION_MONTH_DAYS = 30;

// Whole 30-day probation months in the 180-day term (mirrors the backend).
export const PROBATION_MONTHS = PROBATION_DAYS / PROBATION_MONTH_DAYS;

// Article 296 regularizing standard: an immutable 4.0/5.0 floor. Employers may
// set higher per-competency targets via /api/kpi-rubrics, but never lower.
export const TARGET = 4.0;

// Score-key floor: a competency below this is a "critical gap" (the single 3.0
// boundary shared by scoreTone() and every printed score key).
export const CRITICAL_GAP_FLOOR = 3.0;

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

// One-line rubric summary per competency — single source, shown under the
// competency name wherever scores are listed (record sheet + employee view).
export const COMPETENCY_DESCRIPTIONS = {
  task_completion: 'Deliverables completed on schedule and adherence to task assignments',
  quality_of_work: 'Accuracy, attention to detail, and compliance with quality standards',
  attendance_and_punctuality: 'On-time arrival and dependability during scheduled hours',
  communication_and_teamwork: 'Cross-functional collaboration and clear status reporting',
  initiative_and_adaptability: 'Self-driven problem solving and agility to change',
};
