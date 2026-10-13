import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, interventionApi } from '../../api';
import {
  Button,
  Skeleton,
  Page,
  CountUp,
  SectionHead,
  StatBand,
  PageGrid,
  Row,
  Col,
} from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDayMonth, milestoneDate } from '../../utils/datetime';
import {
  PROBATION_DAYS,
  MILESTONE_REVIEW,
  MILESTONE_NOTICE,
  MILESTONE_CRITICAL,
} from '../../config/domain';
import {
  milestoneFor,
  nextMilestone,
  scoreTone,
  TONE_TEXT,
  TONE_BG,
  TONE_FILL,
} from '../../utils/status';
// Employer dashboard — the overview: a two-cell KPI strip, then the overall
// score chart + interventions (left) and milestone alerts (right). Every value
// comes from the API/DB (scores via each employee's scorecard; no invented
// numbers).
const MILE_LABEL = {
  [MILESTONE_REVIEW]: `Day ${MILESTONE_REVIEW} review`,
  [MILESTONE_NOTICE]: `Day ${MILESTONE_NOTICE} notice`,
  [MILESTONE_CRITICAL]: `Day ${MILESTONE_CRITICAL} critical`,
  [PROBATION_DAYS]: `Day ${PROBATION_DAYS} cap`,
};

// Current window label for an employee who has reached the review milestone.
const windowLabel = (days) => {
  if (days > PROBATION_DAYS) {
    return `Past the Day ${PROBATION_DAYS} cap · regular by operation of law`;
  }
  if (days >= MILESTONE_CRITICAL) return `Critical window · Day ${MILESTONE_CRITICAL} reached`;
  if (days >= MILESTONE_NOTICE) return `Written-notice window · Day ${MILESTONE_NOTICE} reached`;
  return `Performance review due · Day ${MILESTONE_REVIEW} reached`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dispatch any due statutory milestone alerts (idempotent) on dashboard load.
  useEffect(() => {
    employeeApi
      .scanMilestones()
      .then((res) => {
        if (res?.fired) queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .catch(() => {});
  }, [queryClient]);

  const { data: employees = [], isLoading: isEmpLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const {
    data: plans = [],
    isLoading: isPlansLoading,
    isError: isPlansError,
  } = useQuery({
    queryKey: ['intervention-plans'],
    queryFn: () => interventionApi.listPending(),
  });

  const activeProbationers = useMemo(
    () => employees.filter((e) => e.status === 'active'),
    [employees]
  );

  // Overall score chart — one scorecard per active probationer (404 = not rated
  // yet, so it simply drops out rather than showing a made-up number).
  const scoreQueries = useQueries({
    queries: activeProbationers.map((e) => ({
      queryKey: ['scorecard', e.id],
      // A 404 means "no evaluations yet" — return null so it drops out quietly.
      queryFn: async () => {
        try {
          return (await evaluationApi.getScorecard(e.id)) ?? null;
        } catch {
          return null;
        }
      },
      retry: false,
      staleTime: 60_000,
    })),
  });

  // Overall score chart — one row per active probationer. A 404 scorecard means
  // "not rated yet", so the employee is kept and shown as "No score yet" rather
  // than dropped (the row must not silently disappear from the count).
  const scores = useMemo(
    () =>
      activeProbationers
        .map((e, i) => ({ emp: e, sc: scoreQueries[i].data }))
        .sort((a, b) => {
          const av = a.sc ? Number(a.sc.overall_score) : -1;
          const bv = b.sc ? Number(b.sc.overall_score) : -1;
          return bv - av;
        }),
    [activeProbationers, scoreQueries]
  );
  const scoresLoading = scoreQueries.some((q) => q.isLoading);

  // Scorecard by employee id (null = not rated yet), so an alert row can show
  // its score without re-fetching.
  const scById = useMemo(() => {
    const map = {};
    activeProbationers.forEach((e, i) => {
      map[e.id] = scoreQueries[i]?.data || null;
    });
    return map;
  }, [activeProbationers, scoreQueries]);

  const stats = useMemo(() => {
    let pastCap = 0;
    let decisionsDue = 0;
    activeProbationers.forEach((emp) => {
      const d = getDaysElapsed(emp.start_date);
      if (d > PROBATION_DAYS) pastCap += 1;
      else if (d >= MILESTONE_REVIEW) decisionsDue += 1;
    });
    return { pastCap, decisionsDue };
  }, [activeProbationers]);

  const targetScore = Number(scores[0]?.sc?.target_score) || 4.0;

  // Alerts — one live row per active probationer who has reached the Day 150
  // review. Carries day/stage, the score when it changes the story, and the next
  // milestone date (the "Next deadlines" table's only unique content).
  const alerts = useMemo(
    () =>
      activeProbationers
        .map((emp) => {
          const days = getDaysElapsed(emp.start_date);
          const next = nextMilestone(days);
          return {
            emp,
            days,
            next,
            nextDate: next ? milestoneDate(emp.start_date, next) : null,
            capDate: emp.day_180_date,
            tone: milestoneFor(days, emp.status).tone,
            sc: scById[emp.id] || null,
          };
        })
        .filter((a) => a.days >= MILESTONE_REVIEW)
        .sort((a, b) => b.days - a.days),
    [activeProbationers, scById]
  );

  const kpis = [
    {
      label: 'Past cap · auto-regular',
      value: <CountUp value={stats.pastCap} />,
      caption: `Past Day ${PROBATION_DAYS} · regular by operation of law`,
      tone: 'bad',
    },
    {
      label: 'Decisions due',
      value: <CountUp value={stats.decisionsDue} />,
      caption: `Day ${MILESTONE_REVIEW}–${PROBATION_DAYS} window`,
      tone: 'warn',
    },
  ];

  return (
    <Page
      title="Dashboard"
      actions={
        <Button variant="primary" onClick={() => navigate('/supervisor/rate')}>
          Rate employee
        </Button>
      }
    >
      <PageGrid className="space-y-10 lg:space-y-0 lg:gap-y-10">
        {/* KPI strip */}
        <Row>
          <Col span={12}>
            <StatBand cells={kpis} spans={[7, 5]} />
          </Col>
        </Row>

        {/* Overall score + Interventions (left) · Alerts (right) */}
        <Row className="lg:items-start">
          <Col span={7} className="space-y-8">
            <section aria-label="Overall score vs standard">
              <SectionHead
                title="Overall score"
                subtitle={`latest week · target ${targetScore.toFixed(1)}`}
              />
              {isEmpLoading || scoresLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : scores.length === 0 ? (
                <p className="py-6 text-14 text-ink-3">No active probationary employees.</p>
              ) : (
                <div>
                  {scores.map(({ emp, sc }) => {
                    if (!sc) {
                      return (
                        <div
                          key={emp.id}
                          className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
                        >
                          <Link
                            to={`/employees/${emp.id}`}
                            className="w-28 shrink-0 truncate text-14 text-ink hover:underline"
                          >
                            {emp.user?.full_name}
                          </Link>
                          <span className="flex-1 text-14 text-ink-3">No score yet</span>
                          <span className="w-11 shrink-0" />
                        </div>
                      );
                    }
                    const score = Number(sc.overall_score);
                    const target = Number(sc.target_score) || targetScore;
                    const tone = scoreTone(score, target);
                    return (
                      <div
                        key={emp.id}
                        className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
                      >
                        <Link
                          to={`/employees/${emp.id}`}
                          className="w-28 shrink-0 truncate text-14 text-ink hover:underline"
                        >
                          {emp.user?.full_name}
                        </Link>
                        <span className="relative h-2 flex-1 rounded-full bg-hover">
                          <i
                            className={`absolute inset-y-0 left-0 rounded-full ${TONE_FILL[tone]}`}
                            style={{ width: `${(score / 5) * 100}%` }}
                          />
                          <i
                            className="absolute -top-1.5 -bottom-1.5 w-px bg-ink-3/60"
                            style={{ left: `${(target / 5) * 100}%` }}
                            title={`Target ${target.toFixed(1)}`}
                          />
                        </span>
                        <span
                          className={`w-11 shrink-0 text-right text-14 font-semibold font-num ${TONE_TEXT[tone]}`}
                        >
                          {score.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section aria-label="Interventions">
              <SectionHead title="Interventions" subtitle="Training plans pending sign-off" />
              {isPlansLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : isPlansError ? (
                <p className="py-6 text-14 text-bad">
                  Unable to load interventions right now. Please retry.
                </p>
              ) : plans.length === 0 ? (
                <p className="py-3 text-14 leading-relaxed text-ink-2">
                  No interventions awaiting sign-off.
                </p>
              ) : (
                <ul>
                  {plans.slice(0, 3).map((plan) => (
                    <li key={plan.id} className="border-t border-line py-3 first:border-t-0">
                      <div className="text-14 font-semibold text-ink">{plan.intervention_title}</div>
                      <p className="mt-0.5 text-14 leading-relaxed text-ink-2">
                        {plan.rationale || plan.competency?.replace(/_/g, ' ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Col>

          <Col span={5}>
            <section aria-label="Alerts">
              <SectionHead title="Alerts" subtitle="employees at or past the review milestone" />
              {alerts.length === 0 ? (
                <p className="py-6 text-14 text-ink-3">No employees in a milestone window.</p>
              ) : (
                <div>
                  {alerts.map(({ emp, days, next, nextDate, capDate, tone, sc }) => {
                    const score = sc ? Number(sc.overall_score) : null;
                    const target = sc ? Number(sc.target_score) || targetScore : targetScore;
                    // Show the score only when it changes the story: below target
                    // (a gap) or not rated yet — never when it meets the standard.
                    const showScore = !sc || score < target;
                    return (
                      <div key={emp.id} className="flex items-start gap-2.5 border-t border-line py-3 first:border-t-0">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_BG[tone]}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="text-14 text-ink">
                            <Link to={`/employees/${emp.id}`} className="hover:underline">
                              {emp.user?.full_name}
                            </Link>
                            {' · '}
                            <span className="font-num">
                              Day {days} of {PROBATION_DAYS}
                            </span>
                          </div>
                          <div className="mt-0.5 text-14 leading-relaxed text-ink-2">
                            {windowLabel(days)}
                          </div>
                          {showScore ? (
                            <div
                              className={`mt-0.5 text-14 font-num ${
                                sc ? TONE_TEXT[scoreTone(score, target)] : 'text-ink-3'
                              }`}
                            >
                              {sc ? `${score.toFixed(2)} / ${target.toFixed(1)}` : 'No score yet'}
                            </div>
                          ) : null}
                          <div className="mt-0.5 text-12 text-ink-3">
                            {next
                              ? `Next: ${MILE_LABEL[next]}, ${formatDayMonth(nextDate)}.`
                              : `Passed ${formatDayMonth(capDate)}.`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </Col>
        </Row>
      </PageGrid>
    </Page>
  );
}
