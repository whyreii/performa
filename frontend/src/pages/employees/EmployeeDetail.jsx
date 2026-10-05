import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, ScoreMeter, StatusDot, MilestonePill, Skeleton, Card, CardSkeleton, Page, Modal, EmptyState, Disclosure, textareaClass } from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDate, milestoneDate } from '../../utils/datetime';
import { PROBATION_DAYS, MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL, TARGET } from '../../config/domain';
import { getInitials } from '../../utils/format';
import {
  ArrowLeft,
  Award,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  History,
  Download,
  FileText,
  ArrowRight,
} from '../../components/icons';

const COMPETENCY_DESCRIPTIONS = {
  task_completion: 'Deliverables completed on schedule and adherence to task assignments',
  quality_of_work: 'Accuracy, attention to detail, and compliance with quality standards',
  attendance_and_punctuality: 'On-time arrival and dependability during scheduled hours',
  communication_and_teamwork: 'Cross-functional collaboration and clear status reporting',
  initiative_and_adaptability: 'Self-driven problem solving and agility to change',
};

// One ranked feature-importance row: an independent bar (relative to the largest
// contribution) with a signed percentage. Red = pushed toward the gap, green =
// pushed away from it. Independent bars (not a cumulative waterfall) so the
// ranking reads at a glance.
function ContributionBar({ label, contribution, maxAbs, isRisk }) {
  const width = maxAbs > 0 ? (Math.abs(contribution) / maxAbs) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-12 font-mono text-ink-2">
        <span className="font-sans">{label}</span>
        <span>
          {contribution >= 0 ? '+' : '−'}
          {(Math.abs(contribution) * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isRisk ? 'bg-bad' : 'bg-good'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('regularized');
  const [statusReason, setStatusReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Fetch employee profile
  const {
    data: employee,
    isLoading: isEmpLoading,
    isError: isEmpError,
    error: empError,
  } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeApi.getById(id),
    enabled: !!id,
  });

  // Fetch audit trail history first (returns [] when there are no evaluations)
  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery({
    queryKey: ['audit-trail', id],
    queryFn: () => evaluationApi.getAuditTrail(id),
    enabled: !!id,
  });

  // Fetch scorecard & competencies only once evaluations exist
  // (scorecard/trend/risk/regularization intentionally return 404 when there are none)
  const hasEvaluations = auditLogs.length > 0;
  const {
    data: scorecard,
    isLoading: isScoreLoading,
    isError: isScoreError,
  } = useQuery({
    queryKey: ['scorecard', id],
    queryFn: () => evaluationApi.getScorecard(id),
    enabled: !!id && hasEvaluations,
  });

  // Status transition mutation (regularize or terminate)
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }) => employeeApi.updateStatus(id, status, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsDeactivateModalOpen(false);
      toast.success(`Employee status transitioned to ${variables.status}.`);
    },
    onError: (err) => {
      setActionError(getApiErrorMessage(err, 'Failed to update employee status.'));
    },
  });

  // Standards acknowledgment mutation
  const ackMutation = useMutation({
    mutationFn: () => employeeApi.acknowledgeStandards(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      toast.success('Standards acknowledgement recorded.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to acknowledge standards.'));
    },
  });

  const { data: trend = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['trend', id],
    queryFn: () => evaluationApi.getTrend(id),
    enabled: !!id && hasEvaluations,
    retry: false,
  });

  const { data: regularization } = useQuery({
    queryKey: ['regularization', id],
    queryFn: () => evaluationApi.getRegularization(id),
    enabled: !!id && hasEvaluations,
    retry: false,
  });

  const { data: riskExplanation, isLoading: isRiskLoading } = useQuery({
    queryKey: ['risk-explanation', id],
    queryFn: () => evaluationApi.getRiskExplanation(id),
    enabled: !!id && hasEvaluations,
    retry: false,
  });

  // Overall regularization target for the trend marker (max configured target,
  // floored at TARGET) — never a hardcoded 4.0 / 80%.
  const overallTarget = useMemo(() => {
    const targets = (scorecard?.competencies || [])
      .map((c) => Number(c.target))
      .filter((v) => Number.isFinite(v));
    return targets.length ? Math.max(TARGET, ...targets) : TARGET;
  }, [scorecard]);

  // Feature importance for the ML Risk Explanation: rank each competency by how
  // much it moved this employee's prediction (exact Shapley, backend/ml/explain.py),
  // plus the model-wide importance (Gini). Independent bars, not a cumulative
  // waterfall, so the ranking is readable at a glance.
  const shap = riskExplanation?.shap_values || {};
  const contributionRows = Object.entries(shap)
    .map(([key, value]) => ({ key, contribution: Number(value) }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const maxAbsContribution = contributionRows.reduce(
    (max, row) => Math.max(max, Math.abs(row.contribution)),
    0
  );
  const modelImportance = Object.entries(riskExplanation?.feature_importances || {})
    .map(([key, value]) => ({ key, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  const regularizationMutation = useMutation({
    mutationFn: () => evaluationApi.generateRegularization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regularization', id] });
      toast.success('AI regularization recommendation generated successfully.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to generate regularization recommendation.'));
    },
  });

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const reportHtml = await evaluationApi.getReportHtml(id);
      const blob = new Blob([reportHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        // Popup blocked — fall back to a download.
        const a = document.createElement('a');
        a.href = url;
        a.download = 'performa-performance-report.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to export report.'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLegalNotice = () => {
    if (!employee) return;
    const elapsed = getDaysElapsed(employee.start_date);
    const overall = scorecard?.overall_score ?? 'Pending';
    const competenciesText = (scorecard?.competencies || [])
      .map(
        (c) =>
          `   • ${c.label}: ${c.score.toFixed(2)} / 5.00 [${
            c.gap < 0 ? `GAP: ${c.gap.toFixed(2)}` : 'MET BENCHMARK'
          }]`
      )
      .join('\n');

    const noticeText = `========================================================================
REPUBLIC OF THE PHILIPPINES | LABOR CODE ARTICLE 296
STATUTORY PROBATIONARY EVALUATION NOTICE
========================================================================
Date Generated: ${formatDate(new Date())} (Asia/Manila Standard Time)
Organization: ${user?.organization_name || user?.organization_id || 'N/A'}
Employee: ${employee.user?.full_name || 'N/A'}
Job Title / Department: ${employee.job_title} · ${employee.department}
Start Date: ${formatDate(employee.start_date)} | Days Elapsed: Day ${elapsed} of ${PROBATION_DAYS}
Statutory Status: ${
      elapsed >= MILESTONE_CRITICAL
        ? `CRITICAL (Day ${MILESTONE_CRITICAL}+ Auto-Regularization Risk)`
        : elapsed >= MILESTONE_NOTICE
        ? `DAY ${MILESTONE_NOTICE} NOTICE WINDOW (15-Day Buffer)`
        : elapsed >= MILESTONE_REVIEW
        ? `DAY ${MILESTONE_REVIEW} PERFORMANCE REVIEW DUE`
        : `ON TRACK (< Day ${MILESTONE_REVIEW})`
    }

1. STATUTORY BENCHMARK (Article 296 Standard)
   Mandatory Regularizing Benchmark: ${TARGET.toFixed(2)} / 5.00 across all 5 core competencies
   Current Overall Rating: ${typeof overall === 'number' ? overall.toFixed(2) : overall} / 5.00 ${
      typeof overall === 'number' && overall >= TARGET
        ? '[MET STATUTORY BENCHMARK]'
        : '[BELOW STATUTORY BENCHMARK]'
    }

2. COMPETENCY SCORE BREAKDOWN
${competenciesText || '   • No weekly ratings submitted yet.'}

3. STATUTORY NOTICE TIMELINE
   Day ${MILESTONE_REVIEW} Review Date: ${formatDate(milestoneDate(employee.start_date, MILESTONE_REVIEW))}
   Day ${MILESTONE_NOTICE} Written Notice Deadline: ${formatDate(milestoneDate(employee.start_date, MILESTONE_NOTICE))}
   Day ${PROBATION_DAYS} Legal Ceiling: ${formatDate(employee.day_180_date)}
========================================================================`;

    navigator.clipboard
      .writeText(noticeText)
      .then(() => {
        toast.success('DOLE Article 296 legal notice copied to clipboard.');
      })
      .catch(() => {
        toast.error('Failed to copy notice to clipboard.');
      });
  };

  if (isEmpLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isEmpError || !employee) {
    return (
      <Card padded={false} className="p-12 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-bad mx-auto" />
        <h2 className="text-22 font-semibold text-ink">Employee profile not found</h2>
        <p className="text-12 text-ink-3">
          {getApiErrorMessage(empError, 'The requested probationary profile does not exist.')}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            navigate(
              user?.role === 'probationary_employee' ? '/employee/dashboard' : '/employees'
            )
          }
        >
          {user?.role === 'probationary_employee' ? 'Back to My Scorecard' : 'Back to Directory'}
        </Button>
      </Card>
    );
  }

  const daysElapsed = getDaysElapsed(employee.start_date);
  const daysRemaining = Math.max(0, PROBATION_DAYS - daysElapsed);
  const progressPct = Math.min(100, Math.round((daysElapsed / PROBATION_DAYS) * 100));
  const reachedMilestone =
    [MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL, PROBATION_DAYS]
      .filter((m) => m <= daysElapsed)
      .pop() || null;

  const canManageStatus = user?.role === 'employer';
  const canRate = user?.role === 'supervisor' || user?.role === 'employer';

  return (
    <Page printSheet header={false}>
      <div className="sheet">
      {/* Print-only official document header */}
      <div className="print-only mb-6 pb-4 border-b-2 border-black">
        <p className="text-center text-12 font-semibold tracking-widest uppercase">
          Republic of the Philippines
        </p>
        <p className="text-center text-22 font-bold mt-1">
          Probationary Performance Evaluation Report
        </p>
        <p className="text-center text-12 mt-1">
            Labor Code of the Philippines · Article 296 · {user?.organization_name || user?.organization_id || ''}
        </p>
        <div className="mt-3 text-12 leading-relaxed">
          <p>
            <b>Employee:</b> {employee.user?.full_name}
          </p>
          <p>
            <b>Job Title / Department:</b> {employee.job_title} · {employee.department}
          </p>
          <p>
            <b>Start Date:</b> {formatDate(employee.start_date)} · <b>Day:</b> {daysElapsed} of {PROBATION_DAYS}
          </p>
          <p>
            <b>Generated:</b> {formatDate(new Date())} (Asia/Manila Standard Time)
          </p>
        </div>
      </div>

      {/* In the split view the record list is the navigation; only the
          employee's own record (no directory context) keeps an explicit way back. */}
      {user?.role === 'probationary_employee' && (
        <div className="pt-4">
          <button
            type="button"
            onClick={() => navigate('/employee/dashboard')}
            className="inline-flex items-center gap-1.5 text-12 font-semibold text-ink-2 hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Scorecard</span>
          </button>
        </div>
      )}

      {/* 1. Record header (sticky) */}
      <header className="rec">
        <div className="rec__av">{getInitials(employee.user?.full_name)}</div>
        <div className="rec__id">
          <div className="rec__top">
            <h1 className="rec__name">{employee.user?.full_name}</h1>
            <MilestonePill daysElapsed={daysElapsed} status={employee.status} />
          </div>
          <div className="rec__meta">
            {employee.job_title} · {employee.department} · {employee.user?.email}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rec__acts">
          {canRate && employee.status === 'active' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={Award}
              onClick={() => navigate(`/supervisor/rate?employee=${employee.id}`)}
            >
              Rate Employee
            </Button>
          )}

          {canManageStatus && employee.status === 'active' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedStatus('regularized');
                setStatusReason('');
                setActionError('');
                setIsDeactivateModalOpen(true);
              }}
            >
              Update Status
            </Button>
          )}

          {user?.role !== 'probationary_employee' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={FileText}
                onClick={handleCopyLegalNotice}
                aria-label="Copy legal notice"
                title="Copy legal notice"
                className="w-8 px-0"
              />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={Download}
                isLoading={isExporting}
                onClick={handleExport}
                aria-label="Export report"
                title="Export report"
                className="w-8 px-0"
              />
            </>
          )}
        </div>
      </header>

      {/* Initial Standards Notice */}
      <div className="note">
        <CheckCircle2
          className={`w-4 h-4 shrink-0 ${
            employee.standards_acknowledged_at ? 'text-ok' : 'text-warn'
          }`}
        />
        <span>
          {employee.standards_acknowledged_at ? (
            <>
              Initial performance standards acknowledged on{' '}
              <span className="font-mono">
                {formatDate(employee.standards_acknowledged_at)}
              </span>
            </>
          ) : (
            'Performance standards not yet acknowledged by employee'
          )}
        </span>

        {!employee.standards_acknowledged_at && user?.role === 'probationary_employee' && (
          <Button
            variant="subtle"
            size="sm"
            className="ml-auto"
            isLoading={ackMutation.isPending}
            onClick={() => ackMutation.mutate()}
          >
            Sign Acknowledgment
          </Button>
        )}
      </div>

      {/* 2. Statutory deadline scale (Article 296) */}
      <Card className="rec-block space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-16 font-semibold text-ink">Probation timeline</h2>
            <p className="text-12 text-ink-3 mt-0.5">Art. 296 · Asia/Manila</p>
          </div>
          <div className="font-mono text-12 text-ink">
            <b>Day {daysElapsed}</b> / {PROBATION_DAYS} ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining)
          </div>
        </div>

        {/* Deadline scale: hairline track, Day 150-180 window, ticks, today marker */}
        <div
          className="relative h-[42px]"
          role="img"
          aria-label={`Day ${daysElapsed} of ${PROBATION_DAYS}. Milestones at Day ${MILESTONE_REVIEW} review, Day ${MILESTONE_NOTICE} notice, Day ${MILESTONE_CRITICAL} critical, and Day ${PROBATION_DAYS} deadline.`}
        >
          <div className="absolute left-0 right-0 top-[21px] h-px bg-line" />
          <div
            className="absolute top-[18px] h-[7px] bg-warn/10"
            style={{ left: `${(MILESTONE_REVIEW / PROBATION_DAYS) * 100}%`, right: 0 }}
          />
          {[MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL].map((m) => (
            <span
              key={m}
              className="absolute top-[17px] w-px h-[9px] bg-ink-3"
              style={{ left: `${(m / PROBATION_DAYS) * 100}%` }}
            />
          ))}
          <span className="absolute top-[15px] w-0.5 h-[14px] bg-ink" style={{ left: `${progressPct}%` }} />
          <span
            className={`absolute top-0 font-mono text-12 text-ink whitespace-nowrap ${
              progressPct > 88 ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{ left: `${progressPct}%` }}
          >
            Day {daysElapsed}
          </span>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between font-mono text-12 text-ink-3">
            <span>Day 0</span>
            <span>Day {PROBATION_DAYS}</span>
          </div>
        </div>

        {/* Milestone ledger */}
        <ul className="border-t border-line">
          {[
            { m: 0, label: 'Start (Day 0)', tone: 'text-ink-3', date: formatDate(employee.start_date) },
            { m: MILESTONE_REVIEW, label: `Day ${MILESTONE_REVIEW} · Review`, tone: 'text-warn', date: formatDate(milestoneDate(employee.start_date, MILESTONE_REVIEW)) },
            { m: MILESTONE_NOTICE, label: `Day ${MILESTONE_NOTICE} · Notice`, tone: 'text-notice', date: formatDate(milestoneDate(employee.start_date, MILESTONE_NOTICE)) },
            { m: MILESTONE_CRITICAL, label: `Day ${MILESTONE_CRITICAL} · Critical`, tone: 'text-bad', date: formatDate(milestoneDate(employee.start_date, MILESTONE_CRITICAL)) },
            { m: PROBATION_DAYS, label: `Day ${PROBATION_DAYS} · Deadline`, tone: 'text-bad', date: formatDate(employee.day_180_date) },
          ].map(({ m, label, tone, date }) => (
            <li
              key={m}
              className="flex items-baseline justify-between gap-4 py-2.5 border-b border-line last:border-b-0"
            >
              <span className={`text-14 ${tone}${m === reachedMilestone ? ' font-semibold' : ''}`}>{label}</span>
              <span className="font-mono text-14 text-ink">{date}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 3. Performance Scorecard & 5 Competencies */}
      <Card className="rec-block space-y-6">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h2 className="text-16 font-semibold text-ink">Scorecard</h2>
            <p className="text-12 text-ink-3 mt-0.5">5 competencies · target 4.0</p>
          </div>

          {scorecard?.latest_evaluation_date ? (
            <div className="text-right">
              <span className="text-12 text-ink-3 block">Overall Average</span>
              <span className="text-22 font-bold font-mono text-ink">
                {Number(scorecard.overall_score).toFixed(1)} / 5.0
              </span>
            </div>
          ) : (
            <span className="text-12 text-ink-3">Initial evaluations pending</span>
          )}
        </div>

        {isScoreLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isScoreError ? (
          <p className="py-8 text-center text-14 text-bad">Unable to load the scorecard right now. Please retry.</p>
        ) : !scorecard || !scorecard.competencies || scorecard.competencies.length === 0 ? (
          <p className="py-8 text-center text-14 text-ink-3">No evaluations have been submitted for this employee yet.</p>
        ) : (
          <ul>
            {scorecard.competencies.map((comp) => (
              <li key={comp.key} className="py-3 border-b border-line last:border-b-0">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-14 font-medium text-ink block">{comp.label}</span>
                    <span className="text-12 text-ink-3 block">
                      {COMPETENCY_DESCRIPTIONS[comp.key] || 'Statutory competency'}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-14 text-ink shrink-0">
                    {Number(comp.score).toFixed(1)}
                  </span>
                </div>
                <div className="mt-2">
                  <ScoreMeter score={comp.score} target={comp.target} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 3b. Monthly KPI Trend */}
      {isTrendLoading && (
        <CardSkeleton className="space-y-4">
          <div className="flex items-center justify-between pb-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-2.5 w-full" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      )}
      {!isTrendLoading && trend.length > 0 && (
        <Disclosure
          title="Monthly KPI Trend"
          subtitle={`Target >= ${overallTarget.toFixed(2)}`}
          meta={`${trend.length} months`}
        >
          <div className="space-y-3">
            {trend.map((point) => (
              <div key={point.month_number} className="space-y-1">
                <div className="flex justify-between text-12 font-mono text-ink-2">
                  <span>Month {point.month_number}</span>
                  <span className={`font-semibold ${Number(point.overall_average) >= overallTarget ? 'text-good' : 'text-warn'}`}>
                    {Number(point.overall_average).toFixed(2)} / 5.0
                  </span>
                </div>
                <div className="relative h-2.5 w-full bg-hover border border-line rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      Number(point.overall_average) >= overallTarget ? 'bg-good' : 'bg-warn'
                    }`}
                    style={{ width: `${(Number(point.overall_average) / 5) * 100}%` }}
                  />
                  {/* Target marker at the configured regularizing target */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-ink/60 z-10"
                    style={{ left: `${(overallTarget / 5) * 100}%` }}
                    title={`Target ${overallTarget.toFixed(2)} / 5.0`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Disclosure>
      )}

      {/* 3c. Regularization Recommendation */}
      <Card className="rec-block space-y-4">
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-16 font-semibold text-ink">Regularization Recommendation</h2>
            <p className="text-12 text-ink-3 mt-0.5">
              AI-assisted decision support at the mid-5th month
            </p>
          </div>
          {user?.role === 'employer' && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={regularizationMutation.isPending}
              disabled={!hasEvaluations}
              title={!hasEvaluations ? 'Submit weekly ratings first' : undefined}
              onClick={() => regularizationMutation.mutate()}
            >
              {regularizationMutation.isPending
                ? 'Generating...'
                : regularization
                ? 'Regenerate'
                : 'Generate'}
            </Button>
          )}
        </div>
        {!hasEvaluations ? (
          <div className="text-14 text-ink-3 space-y-2">
            <p>
              No weekly evaluations recorded yet. A supervisor must submit at least one
              weekly rating before generating AI decision support.
            </p>
            {user?.role !== 'probationary_employee' && (
              <Link
                to={`/supervisor/rate?employee=${id}`}
                className="inline-flex items-center gap-1 text-accent font-semibold hover:underline"
              >
                Rate Employee
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : regularization ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={regularization.recommendation === 'Regularize' ? 'ok' : 'bad'}>
                {regularization.recommendation}
              </Badge>
              <span className="text-14 text-ink-2">{regularization.status_classification}</span>
              <span className="font-mono text-12 text-ink-3">
                Avg {Number(regularization.overall_average).toFixed(2)}
              </span>
            </div>
            {regularization.rationale && (
              <p className="text-14 text-ink-2 leading-relaxed">{regularization.rationale}</p>
            )}
          </div>
        ) : (
          <p className="text-14 text-ink-3">
            Evaluations recorded. Click "Generate" to run the Random Forest classifier and
            Gemini decision rationale.
          </p>
        )}
      </Card>

      {/* 3d. ML Risk Explanation (feature importances) */}
      {isRiskLoading && (
        <CardSkeleton className="space-y-4">
          <div className="flex items-center justify-between pb-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-24 w-full" />
        </CardSkeleton>
      )}
      {!isRiskLoading && riskExplanation && (
        <Card className="rec-block space-y-5 no-print">
          <div className="flex items-center justify-between gap-4 pb-3">
            <div>
              <h2 className="text-16 font-semibold text-ink">ML Risk Explanation</h2>
              <p className="text-12 text-ink-3 mt-0.5">Feature importance for legal defensibility · Random Forest</p>
            </div>
            <Badge variant="accent">
              {riskExplanation.predicted_tier} ·{' '}
              {(Number(riskExplanation.confidence) * 100).toFixed(0)}%
            </Badge>
          </div>

          <p className="text-14 text-ink-2">
            The model predicts{' '}
            <span className="font-semibold text-ink">{riskExplanation.predicted_tier}</span> with{' '}
            <span className="font-semibold text-ink">
              {(Number(riskExplanation.confidence) * 100).toFixed(0)}%
            </span>{' '}
            confidence. Competencies are ranked by how much each moved this prediction.
          </p>

          {/* Feature importance — independent bars, ranked by contribution */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-12 font-medium text-ink-2">Feature importance</span>
              <span className="flex items-center gap-3 text-12 text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-bad" />
                  toward gap
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-good" />
                  away from gap
                </span>
              </span>
            </div>
            {contributionRows.map(({ key, contribution }) => (
              <ContributionBar
                key={key}
                label={key.replace(/_/g, ' ')}
                contribution={contribution}
                maxAbs={maxAbsContribution}
                isRisk={
                  (contribution >= 0) === (riskExplanation.shap_risk_polarity === 'risk')
                }
              />
            ))}
          </div>

          {/* Model-wide importance — single metric (Gini) */}
          <div className="pt-3 border-t border-line">
            <p className="text-12 font-medium text-ink-2 mb-2">Model-wide importance</p>
            <ul className="space-y-1">
              {modelImportance.map(({ key, value }) => (
                <li key={key} className="flex justify-between text-12 font-mono text-ink-2">
                  <span className="font-sans">{key.replace(/_/g, ' ')}</span>
                  <span>{(value * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-12 text-ink-3">
            Feature importance explains the model's output for this employee, not an
            employment decision.
          </p>
        </Card>
      )}

      {/* 4. Immutable Evaluation History Audit Trail */}
      <Disclosure
        title="Evaluation history"
        subtitle="Append-only · one row per change"
        meta={`${auditLogs.length} ${auditLogs.length === 1 ? 'record' : 'records'}`}
      >
        {isAuditLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : auditLogs.length === 0 ? (
          <EmptyState icon={History} title="No evaluations yet">
            No evaluations submitted yet for this employee.
          </EmptyState>
        ) : (
          <>
          <div className="divide-y divide-line">
            {(showAllHistory ? auditLogs : auditLogs.slice(0, 8)).map((log) => {
              const hasPrior = log.prior_score !== null && log.prior_score !== undefined;
              return (
                <div key={log.id} className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-12">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {log.evaluator_name || 'Evaluator'}
                      </span>
                      <span className="text-ink-2">
                        {log.competency?.replace(/_/g, ' ') || 'score'}
                      </span>
                    </div>
                    <span className="font-mono text-ink-3">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-12 font-mono text-ink-2">
                    <span className="text-ink-3">
                      {hasPrior ? `${Number(log.prior_score).toFixed(1)} -> ` : 'Initial -> '}
                    </span>
                    <span className="font-bold text-ink">
                      {Number(log.new_score).toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
            {!showAllHistory && auditLogs.length > 8 && (
              <button
                type="button"
                className="disclosure__more"
                onClick={() => setShowAllHistory(true)}
              >
                Show all {auditLogs.length}
              </button>
            )}
            {showAllHistory && auditLogs.length > 8 && (
              <p className="disclosure__count">Showing all {auditLogs.length} records</p>
            )}
          </>
        )}
      </Disclosure>

      {/* Print-only signature block */}
      <div className="print-only mt-10 pt-6 border-t-2 border-black">
        <p className="text-12 mb-8 leading-relaxed">
          This report is generated from the Performa evidentiary audit trail and is valid for
          Article 296 due-process documentation when printed directly from the system.
        </p>
        <div className="grid grid-cols-2 gap-x-12 gap-y-12 text-12">
          <div className="border-t border-black pt-1">
            <b>Immediate Supervisor / Evaluator</b>
            <span className="block">Signature over printed name</span>
          </div>
          <div className="border-t border-black pt-1">
            <b>Authorized Employer / HR Representative</b>
            <span className="block">Regularization decision authority</span>
          </div>
          <div className="border-t border-black pt-1">
            <b>{employee.user?.full_name}</b>
            <span className="block">Probationary employee — received &amp; acknowledged</span>
          </div>
          <div className="border-t border-black pt-1">
            <b>Date</b>
            <span className="block">Asia/Manila (UTC+8)</span>
          </div>
        </div>
      </div>

      </div>

      {/* Status Transition Modal */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        labelledBy="status-modal-title"
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 id="status-modal-title" className="text-16 font-semibold text-ink">Update Probationary Status</h3>
              <button
                type="button"
                onClick={() => setIsDeactivateModalOpen(false)}
                className="text-ink-3 hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-ctl bg-bad/10 text-bad text-12 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <p className="text-12 text-ink-2">
              Select the statutory status decision for <b>{employee.user?.full_name}</b>:
            </p>

            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-ctl border cursor-pointer transition-colors ${
                  selectedStatus === 'regularized'
                    ? 'border-ok bg-ok/5 text-ink'
                    : 'border-line hover:bg-hover'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="regularized"
                  checked={selectedStatus === 'regularized'}
                  onChange={() => setSelectedStatus('regularized')}
                />
                <div>
                  <span className="font-semibold text-12 block text-ok">Confer Regular Status</span>
                  <span className="text-12 text-ink-3 block">
                    Employee has passed probationary standards.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-ctl border cursor-pointer transition-colors ${
                  selectedStatus === 'terminated'
                    ? 'border-bad bg-bad/5 text-ink'
                    : 'border-line hover:bg-hover'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="terminated"
                  checked={selectedStatus === 'terminated'}
                  onChange={() => setSelectedStatus('terminated')}
                />
                <div>
                  <span className="font-semibold text-12 block text-bad">Non-Regularize / Terminate</span>
                  <span className="text-12 text-ink-3 block">
                    Due to failure to meet initial probationary standards.
                  </span>
                </div>
              </label>
            </div>

            {selectedStatus === 'terminated' && (
              <div>
                <label className="block text-12 font-medium text-ink-2 mb-1.5" htmlFor="status_reason">
                  Reason for Termination *
                </label>
                <textarea
                  id="status_reason"
                  rows={3}
                  maxLength={500}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="State the documented, performance-based justification for non-regularization..."
                  className={textareaClass}
                />
                <p className="text-12 text-ink-3 mt-1 font-mono">
                  {statusReason.length} / 500 characters
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-line">
              <Button
                variant="ghost"
                onClick={() => setIsDeactivateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant={selectedStatus === 'regularized' ? 'primary' : 'danger'}
                isLoading={statusMutation.isPending}
                onClick={() => {
                  if (selectedStatus === 'terminated' && !statusReason.trim()) {
                    setActionError('A reason is required when terminating an employee.');
                    return;
                  }
                  setActionError('');
                  statusMutation.mutate({
                    status: selectedStatus,
                    reason: statusReason.trim() || undefined,
                  });
                }}
              >
                Confirm Decision
              </Button>
            </div>
      </Modal>
    </Page>
  );
}
