import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, interventionApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, MilestonePill, Skeleton, Card, Page, AsyncBoundary, SectionHead } from '../../components/ui';
import { daysElapsed as getDaysElapsed, daysUntil, monthNumberFor, formatDate, milestoneDate } from '../../utils/datetime';
import { PROBATION_DAYS, PROBATION_MONTHS, MILESTONE_REVIEW, TARGET, COMPETENCIES } from '../../config/domain';
import { CheckCircle2, ArrowRight, BookOpen, TrendingUp, UserCheck } from '../../components/icons';

const LABEL_BY_KEY = Object.fromEntries(COMPETENCIES.map((c) => [c.key, c.label]));
const competencyLabel = (key) => LABEL_BY_KEY[key] || key.replace(/_/g, ' ');

// Monthly-summary competency averages, in the order the API returns them.
const SUMMARY_COMPETENCY_FIELDS = [
  { field: 'avg_task_completion', label: 'Task Completion' },
  { field: 'avg_attendance', label: 'Attendance & Punctuality' },
  { field: 'avg_communication', label: 'Communication & Teamwork' },
  { field: 'avg_initiative', label: 'Initiative & Adaptability' },
  { field: 'avg_quality', label: 'Quality of Work' },
];

// A second-person, per-lens reading of a monthly summary for the employee's own
// view. Deterministic (derived from the summary's own averages) so the employee
// never reads the employer's third-person wording as their own voice.
function employeeSummaryLine(summary) {
  const scored = SUMMARY_COMPETENCY_FIELDS.map((c) => ({
    label: c.label,
    value: Number(summary[c.field]),
  })).filter((c) => Number.isFinite(c.value));
  if (!scored.length) return null;
  const lowest = scored.reduce((a, b) => (b.value < a.value ? b : a));
  return summary.status_classification === 'Meets Expectations'
    ? `You're meeting the regularizing standard across all five competencies. Smallest margin: ${lowest.label} (${lowest.value.toFixed(2)}).`
    : `You're below the regularizing standard in at least one competency. Lowest: ${lowest.label} (${lowest.value.toFixed(2)}).`;
}

// Competency radar: the employee's five scores as a shape over the 4.0 target ring.
function Radar({ competencies }) {
  const cx = 110;
  const cy = 110;
  const R = 90;
  const n = competencies.length || 1;
  const point = (i, value) => {
    const a = ((-90 + i * (360 / n)) * Math.PI) / 180;
    const r = (Math.max(0, Math.min(5, Number(value) || 0)) / 5) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const toPoly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const outer = toPoly(competencies.map((_, i) => point(i, 5)));
  const target = toPoly(competencies.map((_, i) => point(i, TARGET)));
  const shape = toPoly(competencies.map((c, i) => point(i, c.score)));
  const dots = competencies.map((c, i) => {
    const [x, y] = point(i, c.score);
    return { key: c.key, x, y, meets: Number(c.score) >= Number(c.target) };
  });
  return (
    <svg width="230" height="230" viewBox="0 0 220 220" role="img" aria-label="Your competency scores against the 4.0 target">
      <g fill="none" stroke="var(--line)" strokeWidth="1">
        <polygon points={outer} />
        <polygon points={toPoly(competencies.map((_, i) => point(i, 3))) } />
        {competencies.map((_, i) => {
          const [x, y] = point(i, 5);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} />;
        })}
      </g>
      <polygon points={target} fill="none" stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="4 4" />
      <polygon points={shape} fill="color-mix(in srgb, var(--good) 22%, transparent)" stroke="var(--good)" strokeWidth="2" />
      {dots.map((d) => (
        <circle key={d.key} cx={d.x} cy={d.y} r="2.6" fill={d.meets ? 'var(--good)' : 'var(--warn)'} />
      ))}
    </svg>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    data: employees = [],
    isLoading: isEmpLoading,
    isError: isEmpError,
    error: empError,
    refetch: refetchEmployees,
  } = useQuery({ queryKey: ['employees'], queryFn: () => employeeApi.list() });

  const myProfile = useMemo(
    () => employees.find((e) => e.user_id === user?.id || e.user?.email === user?.email),
    [employees, user]
  );

  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery({
    queryKey: ['audit-trail', myProfile?.id],
    queryFn: () => evaluationApi.getAuditTrail(myProfile.id),
    enabled: !!myProfile?.id,
  });

  const { data: scorecard, isLoading: isScoreLoading } = useQuery({
    queryKey: ['scorecard', myProfile?.id],
    queryFn: () => evaluationApi.getScorecard(myProfile.id),
    enabled: !!myProfile?.id && auditLogs.length > 0,
  });

  const { data: trend = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['trend', myProfile?.id],
    queryFn: () => evaluationApi.getTrend(myProfile.id),
    enabled: !!myProfile?.id && auditLogs.length > 0,
    retry: false,
  });

  const { data: mySummaries = [], isLoading: isSummariesLoading } = useQuery({
    queryKey: ['my-summaries'],
    queryFn: () => interventionApi.listMySummaries(),
  });

  const { data: myTraining = [], isLoading: isTrainingLoading } = useQuery({
    queryKey: ['my-interventions'],
    queryFn: () => interventionApi.listMine(),
  });

  // Behavioral notes from weekly ratings (supervisor narrative)
  const { data: weeklyRemarks = [], isLoading: isRemarksLoading } = useQuery({
    queryKey: ['weekly-evaluations', myProfile?.id],
    queryFn: () => evaluationApi.listWeekly(myProfile.id),
    enabled: !!myProfile?.id,
  });
  const notedRemarks = useMemo(
    () => weeklyRemarks.filter((r) => r.remarks && r.remarks.trim()),
    [weeklyRemarks]
  );

  const ackSummaryMutation = useMutation({
    mutationFn: (id) => interventionApi.acknowledgeSummary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-summaries'] });
      toast.success('Summary acknowledged.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to acknowledge summary.')),
  });

  const daysElapsed = myProfile ? getDaysElapsed(myProfile.start_date) : 0;
  const daysRemaining = Math.max(0, PROBATION_DAYS - daysElapsed);
  const daysToReview = myProfile
    ? daysUntil(milestoneDate(myProfile.start_date, MILESTONE_REVIEW))
    : null;
  const overall = scorecard ? Number(scorecard.overall_score) : null;
  const meetsStandard = overall !== null && overall >= TARGET;
  const first = (user?.full_name || '').split(' ')[0] || 'there';
  const unacknowledged = useMemo(() => mySummaries.filter((s) => !s.acknowledged_at), [mySummaries]);
  const currentMonth = Math.max(1, Math.min(PROBATION_MONTHS, monthNumberFor(daysElapsed)));
  // A terminal record has no "current" month — the probation clock has stopped.
  const isTerminal = myProfile?.status === 'regularized' || myProfile?.status === 'terminated';

  if (isEmpError) {
    return (
      <Page title="My Performance Scorecard">
        <AsyncBoundary isError error={empError} onRetry={refetchEmployees} errorMessage="Failed to load your scorecard." />
      </Page>
    );
  }

  const trainingToDo = myTraining.filter((p) => p.status === 'approved');
  const checklist = [
    {
      done: !!myProfile?.standards_acknowledged_at,
      label: 'Acknowledge your performance standards',
      detail: myProfile?.standards_acknowledged_at ? `Done · ${formatDate(myProfile.standards_acknowledged_at)}` : 'Confirm the standards you’re being rated on',
    },
    {
      done: !!scorecard,
      label: 'First weekly ratings recorded',
      detail: scorecard ? 'Done · your supervisor rates you weekly' : 'Waiting for your first evaluation',
    },
    {
      done: !isSummariesLoading && unacknowledged.length === 0,
      label: 'Acknowledge shared monthly summaries',
      detail: unacknowledged.length ? `${unacknowledged.length} awaiting your acknowledgment` : 'All summaries acknowledged',
      action: unacknowledged.length ? { kind: 'ack', summary: unacknowledged[0] } : null,
    },
    {
      done: !isTrainingLoading && trainingToDo.length === 0,
      label: 'Complete assigned training',
      detail: trainingToDo.length
        ? `${trainingToDo.length} module${trainingToDo.length === 1 ? '' : 's'} to complete`
        : myTraining.length
        ? 'All training completed'
        : 'No training assigned',
      action: trainingToDo.length ? { kind: 'training' } : null,
    },
  ];

  return (
    <Page
      title="My Performance Scorecard"
      subtitle={
        <>
          Your probation journey · <span className="font-num text-ink">{user?.organization_name || user?.organization_id}</span>
        </>
      }
      actions={myProfile ? <MilestonePill daysElapsed={daysElapsed} status={myProfile.status} /> : null}
    >
      {/* Dashboard body — main column + side rail on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
      {/* Greeting + plain dates */}
      <Card flat className="p-5">
        {isEmpLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <p className="text-22 font-semibold tracking-tight text-ink">
              {daysToReview === null ? (
                <>Hi {first}.</>
              ) : daysToReview > 0 ? (
                <>Hi {first}, {daysToReview} {daysToReview === 1 ? 'day' : 'days'} to your review.</>
              ) : daysElapsed <= PROBATION_DAYS ? (
                <>Hi {first}, {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} until the {PROBATION_DAYS}-day cap.</>
              ) : (
                <>Hi {first}, you are past the {PROBATION_DAYS}-day cap.</>
              )}
            </p>
            <p className="text-14 text-ink-2 mt-1.5">
              {overall === null
                ? 'Here’s where you stand and what’s next.'
                : meetsStandard
                ? 'You’re meeting the regularizing standard. Keep going.'
                : 'Focus on your competencies below. There’s time to build them up.'}
            </p>
            {myProfile && (
              <p className="text-12 text-ink-3 mt-3">
                Started <span className="font-num text-ink">{formatDate(myProfile.start_date)}</span> · Review{' '}
                <span className="font-num text-ink">{formatDate(milestoneDate(myProfile.start_date, MILESTONE_REVIEW))}</span> · Probation ends{' '}
                <span className="font-num text-ink">{formatDate(myProfile.day_180_date)}</span>
              </p>
            )}
          </>
        )}
      </Card>

      {/* How you're doing */}
      <Card className="p-5">
        <SectionHead
          title="How you’re doing"
          note={
            overall !== null
              ? `${meetsStandard ? 'On track' : 'Below'} · target ${TARGET.toFixed(1)}`
              : `target ${TARGET.toFixed(1)}`
          }
        />
        {isScoreLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !scorecard?.competencies?.length ? (
          <p className="text-14 text-ink-3">Your competency scores will appear once you’ve been rated.</p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            <Radar competencies={scorecard.competencies} />
            <ul className="flex-1 w-full">
              {[...scorecard.competencies]
                .sort((a, b) => Number(b.score) - Number(a.score))
                .map((c) => {
                  const meets = Number(c.score) >= Number(c.target);
                  return (
                    <li
                      key={c.key}
                      className="flex items-baseline justify-between gap-4 py-2.5 border-t border-line first:border-t-0"
                    >
                      <span className="text-14 text-ink">{c.label}</span>
                      <span className={`text-14 font-semibold font-num ${meets ? 'text-good' : 'text-warn'}`}>
                        {Number(c.score).toFixed(1)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </Card>

      {/* G — From your supervisor */}
      <Card flat className="p-5">
        <SectionHead
          title="From your supervisor"
          note={
            notedRemarks.length + auditLogs.length
              ? `${notedRemarks.length + auditLogs.length} updates`
              : undefined
          }
        />
        {isRemarksLoading || isAuditLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : notedRemarks.length === 0 && auditLogs.length === 0 ? (
          <p className="text-14 text-ink-3">No feedback from your supervisor yet.</p>
        ) : (
          <>
            {notedRemarks.length > 0 && (
              <ul className="space-y-4">
                {notedRemarks.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <div className="text-12 text-ink-3">
                      <span className="font-semibold text-ink-2">{r.evaluator_name}</span>
                      {' · '}
                      <span className="font-num">{formatDate(r.evaluation_date)}</span>
                    </div>
                    <p className="text-14 text-ink-2 mt-1 leading-relaxed break-words">{r.remarks}</p>
                  </li>
                ))}
              </ul>
            )}
            {auditLogs.length > 0 && (
              <div className={notedRemarks.length ? 'mt-4 pt-4 border-t border-line' : ''}>
                <p className="text-12 font-semibold text-ink-3 mb-2">Rating changes</p>
                <ul className="space-y-3.5">
                  {auditLogs.slice(0, 4).map((log) => {
                    const hasPrior = log.prior_score !== null && log.prior_score !== undefined;
                    return (
                      <li key={log.id} className="flex items-start gap-3">
                        <UserCheck className="w-5 h-5 shrink-0 mt-0.5 text-ink-3" aria-hidden="true" />
                        <div className="text-14 text-ink-2">
                          <span className="font-semibold text-ink">{log.evaluator_name || 'Your supervisor'}</span>{' '}
                          rated <span className="text-ink">{log.competency ? competencyLabel(log.competency) : 'a competency'}</span>{' '}
                          <span className="font-num text-ink">
                            {hasPrior ? `${Number(log.prior_score).toFixed(1)} → ` : ''}
                            {Number(log.new_score).toFixed(1)}
                          </span>
                          <div className="text-12 text-ink-3 mt-0.5 font-num">{formatDate(log.created_at)}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Monthly summaries */}
        {!isSummariesLoading && mySummaries.length > 0 && (
          <div className="mt-5 pt-5 border-t border-line">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 shrink-0 text-ink-3" aria-hidden="true" />
                <div className="text-14 text-ink">Monthly summaries</div>
              </div>
              {unacknowledged.length === 0 && <Badge variant="ok">All acknowledged</Badge>}
            </div>
            <ul className="space-y-4">
              {[...mySummaries]
                .sort((a, b) => a.month_number - b.month_number)
                .map((s) => (
                  <li key={s.id}>
                    <div className="flex items-center justify-between gap-4">
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
                          Acknowledge Month {s.month_number}
                        </Button>
                      )}
                    </div>
                    {employeeSummaryLine(s) && (
                      <p className="text-14 text-ink mt-1.5 leading-relaxed">{employeeSummaryLine(s)}</p>
                    )}
                    {s.performance_summary && (
                      <p className="text-14 text-ink-2 mt-1 leading-relaxed">
                        <span className="text-ink-3">From your employer: </span>
                        {s.performance_summary}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Card>

        </div>

        {/* Side rail — next steps + monthly progress */}
        <div className="space-y-4 min-w-0">
      {/* Your checklist */}
      <Card flat className="p-5">
        <SectionHead
          title="Your checklist"
          note={`${checklist.filter((c) => c.done).length} of ${checklist.length} done`}
        />
        <ul className="divide-y divide-line">
          {checklist.map((item) => (
            <li key={item.label} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
              {item.done ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-good" aria-hidden="true" />
              ) : (
                <span className="w-5 h-5 shrink-0 mt-0.5 rounded-full border-2 border-ink-3/50" aria-hidden="true" />
              )}
              <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                <div>
                  <div className="text-14 text-ink">
                    {item.label}
                    <span className="sr-only">{item.done ? ', done' : ', to do'}</span>
                  </div>
                  <div className="text-12 text-ink-3 mt-0.5">{item.detail}</div>
                </div>
                {item.action?.kind === 'ack' && (
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={ackSummaryMutation.isPending}
                    onClick={() => ackSummaryMutation.mutate(item.action.summary.id)}
                  >
                    Acknowledge
                  </Button>
                )}
                {item.action?.kind === 'training' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={BookOpen}
                    onClick={() => navigate('/employee/training')}
                  >
                    Open
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Month by month */}
      <Card flat className="p-5">
        <SectionHead title="Month by month" note="your monthly average" />
        {isTrendLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((month) => {
              const point = trend.find((p) => p.month_number === month);
              const hasData = point !== undefined;
              const isNow = !isTerminal && month === currentMonth;
              const meets = hasData && Number(point.overall_average) >= TARGET;
              return (
                <div
                  key={month}
                  className={`rounded-ctl border p-3.5 ${isNow ? 'border-accent/50' : 'border-line'}${
                    hasData ? '' : ' opacity-60'
                  }`}
                >
                  <div className="text-12 text-ink-3 font-semibold">Month {month}</div>
                  {hasData ? (
                    <>
                      <div className={`text-22 font-semibold mt-1 font-num ${meets ? 'text-good' : 'text-warn'}`}>
                        {Number(point.overall_average).toFixed(1)}
                      </div>
                      <div className="h-1.5 rounded-full bg-hover mt-2.5 overflow-hidden">
                        <div
                          className={meets ? 'h-full rounded-full bg-good' : 'h-full rounded-full bg-warn'}
                          style={{ width: `${(Number(point.overall_average) / 5) * 100}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-12 text-ink-3 mt-1.5">{isNow ? 'In progress' : 'Upcoming'}</div>
                  )}
                  {isNow && <div className="text-12 font-semibold text-accent mt-2">You are here</div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Link to="/employee/training" className="inline-flex items-center gap-1 text-12 font-semibold text-accent hover:underline">
          View all training
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Page>
  );
}
