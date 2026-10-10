import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, interventionApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, MilestonePill, Skeleton, Card, Page, ScoreLedger, TimelineDocket, AsyncBoundary } from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDate } from '../../utils/datetime';
import { PROBATION_DAYS, TARGET } from '../../config/domain';
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
} from '../../components/icons';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch all employees to find current user's profile
  const {
    data: employees = [],
    isLoading: isEmpLoading,
    isError: isEmpError,
    error: empError,
    refetch: refetchEmployees,
  } = useQuery({
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
  const daysRemaining = Math.max(0, PROBATION_DAYS - daysElapsed);

  if (isEmpError) {
    return (
      <Page title="My Performance Scorecard">
        <AsyncBoundary
          isError
          error={empError}
          onRetry={refetchEmployees}
          errorMessage="Failed to load your scorecard."
        />
      </Page>
    );
  }

  return (
    <Page
        title="My Performance Scorecard"
        subtitle={
          <>
            Probationary Milestone Tracker &amp; Weekly Evaluations ·{' '}
            <span className="font-num text-ink">{user?.organization_name || user?.organization_id}</span>
          </>
        }
        actions={myProfile ? <MilestonePill daysElapsed={daysElapsed} status={myProfile.status} /> : null}
    >

      {/* 1. Probation Status & Timeline Progress Banner */}
      <Card className="sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-12 font-num text-accent block mb-0.5">
              Philippine Labor Code Article 296
            </span>
            <h2 className="text-16 font-semibold text-ink">Probationary Period Timeline</h2>
          </div>

          <div className="font-num text-12 text-ink flex items-center gap-2">
            <span className="p-1.5 rounded-ctl bg-hover border border-line">
              Start: <b>{formatDate(myProfile?.start_date)}</b>
            </span>
            <span className="p-1.5 rounded-ctl bg-hover border border-line">
              Day {PROBATION_DAYS} Cap: <b>{formatDate(myProfile?.day_180_date)}</b>
            </span>
          </div>
        </div>

        {/* Day counter + the shared 180-day docket */}
        <div className="flex justify-between text-12 font-num text-ink">
          <span>
            <b>Day {daysElapsed}</b> elapsed
          </span>
          <span className="text-ink-3">
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining until regularization review
          </span>
        </div>
        <TimelineDocket
          startDate={myProfile?.start_date}
          day180Date={myProfile?.day_180_date}
          daysElapsed={daysElapsed}
        />
      </Card>

      {/* 2. Competency Scores Breakdown */}
      <Card className="sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <h2 className="text-16 font-semibold text-ink">Competency Standing vs Regularizing Target</h2>
            <p className="text-12 text-ink-3 mt-0.5">
              Minimum {TARGET.toFixed(1)} average required across all 5 legal competencies
            </p>
          </div>

          {scorecard?.latest_evaluation_date ? (
            <div className="text-right">
              <span className="text-12 text-ink-3 block font-num">Current Standing</span>
              <span className="text-22 font-bold font-num text-ink">
                {Number(scorecard.overall_score).toFixed(1)} / 5.0
              </span>
            </div>
          ) : (
            <span className="text-12 text-ink-3">Initial evaluations pending</span>
          )}
        </div>

        {isScoreLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !scorecard || !scorecard.competencies || scorecard.competencies.length === 0 ? (
          <div className="py-8 text-center text-12 text-ink-3">
            No evaluations have been submitted for you yet.
          </div>
        ) : (
          <ScoreLedger competencies={scorecard.competencies} />
        )}
      </Card>

      {/* 3. Feedback Notes & Evidentiary Log */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-16 font-semibold text-ink">Evaluation Audit Trail</h2>
            <p className="text-12 text-ink-3">Append-only record of every competency score change</p>
          </div>
          <span className="font-num text-12 text-ink-3">{auditLogs.length} records</span>
        </div>

        {isAuditLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : auditLogs.length === 0 ? (
          <div className="py-8 text-center text-12 text-ink-3">
            No supervisory feedback remarks logged yet.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {auditLogs.map((log) => {
              const hasPrior = log.prior_score !== null && log.prior_score !== undefined;
              return (
                <div key={log.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between text-12">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {log.evaluator_name || 'Evaluator'}
                      </span>
                      <span className="text-ink-2">
                        {log.competency?.replace(/_/g, ' ') || 'score'}
                      </span>
                    </div>
                    <span className="font-num text-ink-3">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-12 font-num text-ink-2">
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
      </Card>
      {/* Monthly Summaries requiring acknowledgement */}
      {mySummaries.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h2 className="text-16 font-semibold text-ink">Monthly Performance Summaries</h2>
              <p className="text-12 text-ink-3">Please acknowledge receipt of shared summaries</p>
            </div>
            <Badge variant="neutral">{mySummaries.length}</Badge>
          </div>
          <div className="divide-y divide-line">
            {mySummaries.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between gap-4">
                <div className="text-12">
                  <span className="font-semibold text-ink">Month {s.month_number}</span>
                  <span className="text-ink-3 font-num ml-2">
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
        </Card>
      )}
    </Page>
  );
}
