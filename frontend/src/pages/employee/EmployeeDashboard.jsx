import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, interventionApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, ScoreMeter, MilestonePill, Skeleton } from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDate } from '../../utils/datetime';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  Building,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

const COMPETENCY_DESCRIPTIONS = {
  task_completion: 'Job-specific deliverables and quota adherence',
  quality_of_work: 'Attention to detail and SOP compliance',
  attendance_and_punctuality: 'On-time shift arrival and schedule reliability',
  communication_and_teamwork: 'Peer relations and transparent reporting',
  initiative_and_adaptability: 'Problem solving and response to coaching',
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch all employees to find current user's profile
  const { data: employees = [], isLoading: isEmpLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const myProfile = useMemo(() => {
    return employees.find((e) => e.user_id === user?.id || e.user?.email === user?.email);
  }, [employees, user]);

  // Fetch personal audit trail first (returns [] when there are no evaluations)
  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery({
    queryKey: ['audit-trail', myProfile?.id],
    queryFn: () => evaluationApi.getAuditTrail(myProfile.id),
    enabled: !!myProfile?.id,
  });

  // Fetch personal scorecard only once evaluations exist
  // (the endpoint intentionally returns 404 when there are none)
  const { data: scorecard, isLoading: isScoreLoading } = useQuery({
    queryKey: ['scorecard', myProfile?.id],
    queryFn: () => evaluationApi.getScorecard(myProfile.id),
    enabled: !!myProfile?.id && auditLogs.length > 0,
  });

  // Dispatched monthly summaries requiring acknowledgement
  const { data: mySummaries = [] } = useQuery({
    queryKey: ['my-summaries'],
    queryFn: () => interventionApi.listMySummaries(),
  });

  const ackSummaryMutation = useMutation({
    mutationFn: (id) => interventionApi.acknowledgeSummary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-summaries'] });
      toast.success('Summary acknowledged.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to acknowledge summary.'));
    },
  });

  const daysElapsed = myProfile ? getDaysElapsed(myProfile.start_date) : 0;
  const daysRemaining = Math.max(0, 180 - daysElapsed);
  const progressPct = Math.min(100, Math.round((daysElapsed / 180) * 100));

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            My Performance Scorecard
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Probationary Milestone Tracker & Weekly Evaluations ·{' '}
            <span className="font-mono text-ink">Acme PH</span>
          </p>
        </div>

        {myProfile && (
          <MilestonePill daysElapsed={daysElapsed} status={myProfile.status} />
        )}
      </header>

      {/* 1. Probation Status & Timeline Progress Banner */}
      <section className="bg-surface border border-line rounded-float p-6 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-[11px] font-mono text-accent uppercase tracking-wider block mb-0.5">
              Philippine Labor Code Article 296
            </span>
            <h2 className="text-lg font-semibold text-ink">Probationary Period Timeline</h2>
          </div>

          <div className="font-mono text-xs text-ink flex items-center gap-2">
            <span className="p-1.5 rounded-ctl bg-hover border border-line">
              Start: <b>{formatDate(myProfile?.start_date)}</b>
            </span>
            <span className="p-1.5 rounded-ctl bg-hover border border-line">
              Day 180 Cap: <b>{formatDate(myProfile?.day_180_date)}</b>
            </span>
          </div>
        </div>

        {/* Timeline Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono text-ink">
            <span>
              <b>Day {daysElapsed}</b> elapsed
            </span>
            <span className="text-ink-3">
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining until regularization review
            </span>
          </div>

          <div className="relative h-3 w-full bg-hover border border-line rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-performa ${
                daysElapsed >= 178
                  ? 'bg-bad'
                  : daysElapsed >= 165
                  ? 'bg-notice'
                  : daysElapsed >= 150
                  ? 'bg-warn'
                  : 'bg-accent'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
            <div className="p-3 rounded-ctl bg-hover/70 border border-line space-y-1">
              <span className="text-ink-3 block font-mono text-[11px]">Milestone 1</span>
              <span className="font-semibold text-ink block">Day 150 Appraisal</span>
              <p className="text-[11px] text-ink-3">Comprehensive 5th-month evaluation.</p>
            </div>

            <div className="p-3 rounded-ctl bg-hover/70 border border-line space-y-1">
              <span className="text-ink-3 block font-mono text-[11px]">Milestone 2</span>
              <span className="font-semibold text-ink block">Day 165 Notice Window</span>
              <p className="text-[11px] text-ink-3">Statutory 15-day notice threshold.</p>
            </div>

            <div className="p-3 rounded-ctl bg-hover/70 border border-line space-y-1">
              <span className="text-ink-3 block font-mono text-[11px]">Milestone 3</span>
              <span className="font-semibold text-ink block">Day 180 Regularization</span>
              <p className="text-[11px] text-ink-3">Permanent employment conferment.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Competency Scores Breakdown */}
      <section className="bg-surface border border-line rounded-float p-6 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <Award className="w-4 h-4 text-accent" />
              <span>Competency Standing vs Regularizing Target</span>
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              Minimum 4.0 average required across all 5 legal competencies
            </p>
          </div>

          {scorecard?.latest_evaluation_date ? (
            <div className="text-right">
              <span className="text-xs text-ink-3 block font-mono">Current Standing</span>
              <span className="text-2xl font-bold font-mono text-ink">
                {Number(scorecard.overall_score).toFixed(1)} / 5.0
              </span>
            </div>
          ) : (
            <Badge variant="neutral">Initial Evaluations Pending</Badge>
          )}
        </div>

        {isScoreLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !scorecard || !scorecard.competencies || scorecard.competencies.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
            No evaluations have been submitted for you yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scorecard.competencies.map((c) => (
              <div key={c.key} className="p-4 rounded-ctl bg-hover/60 border border-line space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-sm text-ink block">{c.label}</span>
                    <span className="text-xs text-ink-3 block">
                      {COMPETENCY_DESCRIPTIONS[c.key] || 'Statutory competency'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-ink ml-2">
                    {Number(c.score).toFixed(1)}
                  </span>
                </div>
                <ScoreMeter score={c.score} target={c.target} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Feedback Notes & Evidentiary Log */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">Evaluation Audit Trail</h2>
            <p className="text-xs text-ink-3">Append-only record of every competency score change</p>
          </div>
          <Badge variant="neutral">{auditLogs.length} Records</Badge>
        </div>

        {isAuditLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : auditLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
            No supervisory feedback remarks logged yet.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {auditLogs.map((log) => {
              const hasPrior = log.prior_score !== null && log.prior_score !== undefined;
              return (
                <div key={log.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {log.evaluator_name || 'Evaluator'}
                      </span>
                      <Badge variant="accent">
                        {log.competency?.replace(/_/g, ' ') || 'score'}
                      </Badge>
                    </div>
                    <span className="font-mono text-ink-3">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-ink-2">
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
        )}
      </section>
      {/* Monthly Summaries requiring acknowledgement */}
      {mySummaries.length > 0 && (
        <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h2 className="text-base font-semibold text-ink">Monthly Performance Summaries</h2>
              <p className="text-xs text-ink-3">Please acknowledge receipt of shared summaries</p>
            </div>
            <Badge variant="neutral">{mySummaries.length}</Badge>
          </div>
          <div className="divide-y divide-line">
            {mySummaries.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="font-semibold text-ink">Month {s.month_number}</span>
                  <span className="text-ink-3 font-mono ml-2">
                    Avg {Number(s.overall_average).toFixed(2)}
                  </span>
                  <span className="text-ink-3 ml-2 capitalize">
                    {s.status_classification?.replace(/_/g, ' ')}
                  </span>
                </div>
                {s.acknowledged_at ? (
                  <Badge variant="ok">Acknowledged</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={ackSummaryMutation.isPending}
                    onClick={() => ackSummaryMutation.mutate(s.id)}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
