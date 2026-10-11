import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, MilestonePill, Skeleton, Card, Page, Modal, EmptyState, textareaClass, ScoreLedger, TimelineDocket } from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDate, milestoneDate } from '../../utils/datetime';
import { PROBATION_DAYS, MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL, TARGET, COMPETENCIES } from '../../config/domain';
import { BRAND } from '../../config/brand';
import { milestoneTone, TONE_TEXT } from '../../utils/status';
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
  ChevronDown,
  ChevronUp,
} from '../../components/icons';

// One ranked feature-importance row: an independent bar (relative to the largest
// contribution) with a signed percentage. Red = pushed toward the gap, green =
// pushed away from it. Independent bars (not a cumulative waterfall) so the
// ranking reads at a glance.
function ContributionBar({ label, contribution, maxAbs, isRisk }) {
  const width = maxAbs > 0 ? (Math.abs(contribution) / maxAbs) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-12 font-num text-ink-2">
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

// Board card header: title (16) + optional right-hand note (12).
function CardHead({ label, note }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <h2 className="text-16 font-semibold text-ink">{label}</h2>
      {note ? <span className="text-12 text-ink-3 text-right">{note}</span> : null}
    </div>
  );
}

const MILESTONE_WINDOW_LABEL = {
  bad: 'Critical 48h window',
  notice: 'Written-notice window',
  warn: 'Performance review due',
  ok: 'On track',
};

// Competency key → human label, so the ML panel uses the same Title Case names
// as the scorecard (never a raw snake_case key).
const LABEL_BY_KEY = Object.fromEntries(COMPETENCIES.map((c) => [c.key, c.label]));
const competencyLabel = (key) => LABEL_BY_KEY[key] || key.replace(/_/g, ' ');

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
  const [verifyResult, setVerifyResult] = useState(null);

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
  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
    isError: isAuditError,
    error: auditError,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['audit-trail', id],
    queryFn: () => evaluationApi.getAuditTrail(id),
    enabled: !!id,
  });

  // Behavioral remarks attached to weekly evaluations (supervisor narrative)
  const { data: weeklyRemarks = [], isLoading: isRemarksLoading } = useQuery({
    queryKey: ['weekly-evaluations', id],
    queryFn: () => evaluationApi.listWeekly(id),
    enabled: !!id,
  });
  const notedRemarks = useMemo(
    () => weeklyRemarks.filter((r) => r.remarks && r.remarks.trim()),
    [weeklyRemarks]
  );

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

  // Recompute the tamper-evident audit hash chain and surface the result.
  const verifyChainMutation = useMutation({
    mutationFn: () => evaluationApi.verifyAuditChain(id),
    onSuccess: (data) => setVerifyResult(data),
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to verify the audit chain.'));
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
    const statusTone = milestoneTone(elapsed);
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
Organization: ${user?.organization_name || user?.organization_id || '—'}
Employee: ${employee.user?.full_name || '—'}
Job Title / Department: ${employee.job_title} · ${employee.department}
Start Date: ${formatDate(employee.start_date)} | Days Elapsed: Day ${elapsed} of ${PROBATION_DAYS}
Statutory Status: ${
      statusTone === 'bad'
        ? `CRITICAL (Day ${MILESTONE_CRITICAL}+ Auto-Regularization Risk)`
        : statusTone === 'notice'
        ? `DAY ${MILESTONE_NOTICE} NOTICE WINDOW (15-Day Buffer)`
        : statusTone === 'warn'
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
      <Page header={false} printSheet>
        <div className="mx-auto max-w-5xl space-y-4 pt-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </Page>
    );
  }

  if (isEmpError || !employee) {
    return (
      <Page header={false} printSheet>
        <div className="mx-auto max-w-5xl pt-4">
          <div className="py-16 text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-bad mx-auto" />
            <h1 className="text-22 font-semibold text-ink">Employee profile not found</h1>
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
          </div>
        </div>
      </Page>
    );
  }

  const daysElapsed = getDaysElapsed(employee.start_date);
  const daysRemaining = Math.max(0, PROBATION_DAYS - daysElapsed);
  const tone = milestoneTone(daysElapsed);

  const canManageStatus = user?.role === 'employer';
  const canRate = user?.role === 'supervisor' || user?.role === 'employer';
  // A terminal decision (regularized/terminated) supersedes the live milestone
  // clock and the pre-decision AI artifact — both must reflect the decision.
  const isTerminal = employee.status === 'regularized' || employee.status === 'terminated';

  const backTo = user?.role === 'probationary_employee' ? '/employee/dashboard' : '/employees';
  const backLabel = user?.role === 'probationary_employee' ? 'My Scorecard' : 'Employees';

  return (
    <Page printSheet header={false}>
      <div className="mx-auto max-w-5xl">
        {/* Print-only official document header */}
        <div className="print-only mb-6 pb-4 border-b-2 border-black">
          <p className="text-center text-12 font-semibold tracking-widest uppercase">
            {BRAND.name}
          </p>
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

        {/* Back */}
        <div className="pt-4">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-1.5 text-12 font-semibold text-ink-2 hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel}</span>
          </button>
        </div>

        {/* Hero */}
        <Card flat className="p-5 mt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-11 h-11 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-16 font-semibold shrink-0">
              {getInitials(employee.user?.full_name)}
            </div>
            <div className="min-w-0 flex-1 basis-52">
              <h1 className="text-22 font-semibold tracking-tight text-ink">{employee.user?.full_name}</h1>
              <p className="text-12 text-ink-3 mt-1">
                Probationary · {employee.job_title} · {employee.department}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-22 font-semibold font-num text-ink leading-tight">
                {daysElapsed} <span className="text-12 text-ink-3 font-normal">/ {PROBATION_DAYS}</span>
              </div>
              <div className={`text-12 font-semibold mt-1 ${isTerminal ? 'text-ink-3' : TONE_TEXT[tone]}`}>
                {isTerminal ? 'Final record' : MILESTONE_WINDOW_LABEL[tone]}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 basis-full">
              {canRate && employee.status === 'active' && (
                <Button
                  variant="primary"
                  leftIcon={Award}
                  onClick={() => navigate(`/supervisor/rate?employee=${employee.id}`)}
                >
                  Rate Employee
                </Button>
              )}
              {canManageStatus && employee.status === 'active' && (
                <Button
                  variant="secondary"
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
              <MilestonePill daysElapsed={daysElapsed} status={employee.status} className="self-center" />
              {user?.role !== 'probationary_employee' && (
                <div className="ml-auto flex items-center gap-2">
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
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Standards acknowledgment */}
        <div className="mt-3 mb-1 flex items-center gap-2.5 text-12 text-ink-2">
          <CheckCircle2
            className={`w-4 h-4 shrink-0 ${employee.standards_acknowledged_at ? 'text-good' : 'text-warn'}`}
          />
          <span>
            {employee.standards_acknowledged_at ? (
              <>
                Standards acknowledged{' '}
                <span className="font-num">{formatDate(employee.standards_acknowledged_at)}</span>
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

        {employee.status_reason && (
          <div
            className={`mt-3 mb-1 flex items-start gap-2.5 text-12 ${
              employee.status === 'terminated' ? 'text-bad' : 'text-ink-2'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">
                {employee.status === 'terminated' ? 'Non-regularization reason' : 'Status note'}:
              </span>{' '}
              <span>{employee.status_reason}</span>
            </span>
          </div>
        )}

        {/* Overview board */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recommendation — full-width lead card (employer/supervisor only; not shown to the employee) */}
          {user?.role !== 'probationary_employee' && (
          <Card className="p-5 lg:col-span-2">
            <CardHead
              label="Recommendation"
              note={
                user?.role === 'employer' && !isTerminal ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={regularizationMutation.isPending}
                    disabled={!hasEvaluations}
                    title={!hasEvaluations ? 'Submit weekly ratings first' : undefined}
                    onClick={() => regularizationMutation.mutate()}
                  >
                    {regularizationMutation.isPending
                      ? 'Generating…'
                      : regularization
                      ? 'Regenerate'
                      : 'Generate'}
                  </Button>
                ) : null
              }
            />
            {!hasEvaluations ? (
              <div className="text-14 text-ink-3 space-y-3">
                <p>
                  No weekly evaluations recorded yet. A supervisor must submit at least one weekly
                  rating before generating AI decision support.
                </p>
              </div>
            ) : isTerminal ? (
              <>
                <div
                  className={`text-22 font-semibold tracking-tight ${
                    employee.status === 'regularized' ? 'text-good' : 'text-bad'
                  }`}
                >
                  {employee.status === 'regularized' ? 'Regularized' : 'Terminated'}
                </div>
                <p className="text-12 text-ink-3 mt-2">
                  {employee.status === 'regularized'
                    ? 'Final decision recorded: conferring regular status.'
                    : 'Final decision recorded: non-regularization.'}
                </p>
                {regularization && (
                  <div className="mt-4 pt-4 border-t border-line">
                    <span className="block text-12 font-semibold text-ink-3 mb-1.5">
                      Gemini Performance Rationale
                    </span>
                    <p className="text-12 text-ink-3 mb-1">
                      AI recommendation generated before this decision:{' '}
                      <span
                        className={
                          regularization.recommendation === 'Regularize'
                            ? 'text-good font-semibold'
                            : 'text-bad font-semibold'
                        }
                      >
                        {regularization.recommendation}
                      </span>
                      {' · '}
                      {regularization.status_classification} · overall{' '}
                      <span className="font-num">
                        {Number(regularization.overall_average).toFixed(2)}
                      </span>{' '}
                      / 5.0
                    </p>
                    {regularization.rationale && (
                      <p className="text-14 text-ink-2 leading-relaxed">
                        {regularization.rationale}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : regularization ? (
              <>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span
                    className={`text-22 font-semibold tracking-tight ${
                      regularization.recommendation === 'Regularize' ? 'text-good' : 'text-bad'
                    }`}
                  >
                    {regularization.recommendation}
                  </span>
                  <Badge variant={regularization.recommendation === 'Regularize' ? 'ok' : 'bad'}>
                    {regularization.status_classification}
                  </Badge>
                </div>
                <p className="mt-2 text-12 text-ink-3 font-num">
                  overall{' '}
                  <b className="text-ink">{Number(regularization.overall_average).toFixed(2)}</b> / 5.0
                </p>
                {regularization.rationale && (
                  <div className="mt-4 pt-4 border-t border-line">
                    <span className="block text-12 font-semibold text-ink-3 mb-1.5">
                      Gemini Performance Rationale
                    </span>
                    <p className="text-14 text-ink-2 leading-relaxed">{regularization.rationale}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-14 text-ink-3">
                {user?.role === 'employer'
                  ? 'Evaluations recorded. Generate the AI regularization recommendation to see the classifier’s decision support.'
                  : user?.role === 'supervisor'
                  ? 'Evaluations recorded. The AI regularization recommendation is generated by the employer.'
                  : 'Evaluations recorded. An AI-assisted recommendation will appear here once your employer reviews it.'}
              </p>
            )}
          </Card>
          )}

          {/* Competency standing */}
          <Card flat className="p-5">
            <CardHead
              label="Competency standing"
              note={
                scorecard?.latest_evaluation_date
                  ? `Latest week · ${formatDate(scorecard.latest_evaluation_date)}`
                  : `target ${TARGET.toFixed(1)} / 5.0`
              }
            />
            {isScoreLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : isScoreError ? (
              <p className="py-6 text-14 text-bad">Unable to load the scorecard right now. Please retry.</p>
            ) : !scorecard || !scorecard.competencies || scorecard.competencies.length === 0 ? (
              <p className="py-6 text-14 text-ink-3">No evaluations have been submitted for this employee yet.</p>
            ) : (
              <ScoreLedger competencies={scorecard.competencies} />
            )}
          </Card>

          {/* ML Risk Explanation */}
          {(isRiskLoading || riskExplanation) && user?.role !== 'probationary_employee' && (
            <Card flat className="p-5">
              <CardHead
                label="ML Risk Explanation"
                note={
                  riskExplanation
                    ? `Random Forest · ${riskExplanation.predicted_tier} · ${(Number(riskExplanation.confidence) * 100).toFixed(0)}%`
                    : 'Random Forest'
                }
              />
              {isRiskLoading ? (
                <div className="space-y-4">
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
              ) : (
                <div className="space-y-4">
                  <p className="text-12 text-ink-3">
                    Feature importance for legal defensibility. Ranked by how much each moved this
                    prediction (exact Shapley); red raises risk, green lowers it.
                  </p>
                  <div className="space-y-3">
                    {contributionRows.map(({ key, contribution }) => (
                      <ContributionBar
                        key={key}
                        label={competencyLabel(key)}
                        contribution={contribution}
                        maxAbs={maxAbsContribution}
                        isRisk={(contribution >= 0) === (riskExplanation.shap_risk_polarity === 'risk')}
                      />
                    ))}
                  </div>
                  <div className="pt-4 border-t border-line">
                    <p className="text-12 font-semibold text-ink-2 mb-2">Model-wide importance</p>
                    <ul className="space-y-1">
                      {modelImportance.map(({ key, value }) => (
                        <li key={key} className="flex justify-between text-12 font-num text-ink-2">
                          <span className="font-sans">{competencyLabel(key)}</span>
                          <span>{(value * 100).toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-12 text-ink-3">
                    Feature importance explains the model's output for this employee, not an
                    employment decision.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Probation timeline */}
          <Card flat className="p-5">
            <CardHead
              label="Probation timeline"
              note={
                isTerminal
                  ? `Day ${daysElapsed} / ${PROBATION_DAYS} · final record`
                  : `Day ${daysElapsed} / ${PROBATION_DAYS} · ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`
              }
            />
            <TimelineDocket
              startDate={employee.start_date}
              day180Date={employee.day_180_date}
              daysElapsed={daysElapsed}
            />
          </Card>

          {/* Monthly KPI trend */}
          {(isTrendLoading || trend.length > 0) && (
            <Card flat className="p-5">
              <CardHead label="Monthly KPI trend" note={`target ≥ ${overallTarget.toFixed(2)}`} />
              {isTrendLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {trend.map((point) => (
                    <div key={point.month_number} className="space-y-1.5">
                      <div className="flex justify-between text-12 font-num text-ink-2">
                        <span>Month {point.month_number}</span>
                        <span
                          className={`font-semibold ${
                            Number(point.overall_average) >= overallTarget ? 'text-good' : 'text-warn'
                          }`}
                        >
                          {Number(point.overall_average).toFixed(2)} / 5.0
                        </span>
                      </div>
                      <div className="relative h-2.5 w-full bg-hover border border-line rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] ${
                            Number(point.overall_average) >= overallTarget ? 'bg-good' : 'bg-warn'
                          }`}
                          style={{ width: `${(Number(point.overall_average) / 5) * 100}%` }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-ink/60 z-10"
                          style={{ left: `${(overallTarget / 5) * 100}%` }}
                          title={`Target ${overallTarget.toFixed(2)} / 5.0`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Supervisor remarks (behavioral notes from weekly ratings) */}
          <Card flat className="p-5 lg:col-span-2">
            <CardHead
              label="Supervisor remarks"
              note={notedRemarks.length ? `${notedRemarks.length} noted` : undefined}
            />
            {isRemarksLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : notedRemarks.length === 0 ? (
              <p className="text-14 text-ink-3">No behavioral remarks recorded yet.</p>
            ) : (
              <ul className="space-y-4">
                {notedRemarks.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <div className="text-12 text-ink-3">
                      <span className="font-semibold text-ink-2">{r.evaluator_name}</span>
                      {' · '}
                      <span className="font-num">{formatDate(r.evaluation_date)}</span>
                    </div>
                    <p className="text-14 text-ink-2 mt-1 leading-relaxed">{r.remarks}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Evaluation history (immutable audit trail) */}
          <Card flat className="p-5 lg:col-span-2">
            <CardHead
              label="Evaluation history"
              note={
                <span className="inline-flex items-center gap-2">
                  <span>
                    {auditLogs.length} {auditLogs.length === 1 ? 'record' : 'records'} · append-only
                  </span>
                  {auditLogs.length > 0 &&
                    (verifyResult ? (
                      <Badge variant={verifyResult.valid ? 'ok' : 'bad'}>
                        {verifyResult.valid
                          ? `Chain verified · ${verifyResult.checked}`
                          : 'Chain broken'}
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => verifyChainMutation.mutate()}
                        disabled={verifyChainMutation.isPending}
                        className="text-accent font-semibold hover:underline disabled:opacity-50"
                      >
                        {verifyChainMutation.isPending ? 'Verifying…' : 'Verify integrity'}
                      </button>
                    ))}
                </span>
              }
            />
            {isAuditLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : isAuditError ? (
              <div className="py-8 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 mx-auto text-bad" />
                <p className="text-12 text-bad">
                  {getApiErrorMessage(auditError, 'Failed to load the evaluation history.')}
                </p>
                <Button variant="secondary" size="sm" onClick={() => refetchAudit()}>
                  Retry
                </Button>
              </div>
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
                      <div
                        key={log.id}
                        className="py-3 flex items-baseline justify-between gap-4 text-12"
                      >
                        <div className="min-w-0">
                          <div className="text-ink">
                            <b>{log.competency ? competencyLabel(log.competency) : 'score'}</b>{' '}
                            <span className="text-ink-3">· {log.evaluator_name || 'Evaluator'}</span>
                          </div>
                          <div className="font-num text-ink-2 mt-1">
                            {hasPrior ? `${Number(log.prior_score).toFixed(1)} → ` : 'Initial → '}
                            <b className="text-ink">{Number(log.new_score).toFixed(1)}</b>
                          </div>
                        </div>
                        <span className="font-num text-ink-3 shrink-0">{formatDate(log.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
                {auditLogs.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllHistory((v) => !v)}
                    aria-expanded={showAllHistory}
                    className="mt-4 inline-flex items-center gap-1.5 text-12 font-semibold text-accent hover:underline"
                  >
                    {showAllHistory ? 'Show less' : `Show more · ${auditLogs.length - 8} more`}
                    {showAllHistory ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </>
            )}
          </Card>
        </div>

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
              <span className="block">Probationary employee · received &amp; acknowledged</span>
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
              placeholder="State the documented, performance-based justification for non-regularization…"
              className={textareaClass}
            />
            <p className="text-12 text-ink-3 mt-1 font-num">
              {statusReason.length} / 500 characters
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-line">
          <Button variant="ghost" onClick={() => setIsDeactivateModalOpen(false)}>
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
