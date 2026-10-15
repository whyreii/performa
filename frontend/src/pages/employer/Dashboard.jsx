import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeApi, interventionApi } from '../../api';
import {
  Button,
  Skeleton,
  Page,
  CountUp,
  SectionHead,
  StatBand,
  Th,
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
import { ROUTES } from '../../config/nav';
import {
  formatProbationDay,
  milestoneFor,
  nextMilestone,
  scoreTone,
  TONE_TEXT,
  TONE_BG,
  TONE_FILL,
} from '../../utils/status';
// Employer dashboard — the overview: a KPI strip, then one "Probation status"
// table (day + score + next milestone per active probationer) and the pending
// training plans. Every value comes from the API/DB (scores via each employee's
// scorecard; no invented numbers).
const MILE_LABEL = {
  [MILESTONE_REVIEW]: `Day ${MILESTONE_REVIEW} · Performance appraisal`,
  [MILESTONE_NOTICE]: `Day ${MILESTONE_NOTICE} · Milestone review`,
  [MILESTONE_CRITICAL]: `Day ${MILESTONE_CRITICAL} · Final milestone`,
  [PROBATION_DAYS]: `Day ${PROBATION_DAYS} · Probation cap`,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dispatch any due probation milestone alerts (idempotent) on dashboard load.
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

  // The table mirrors the employer roster: active employees plus those awaiting
  // assignment, so a newly created account shows here too (as pending).
  const probationers = useMemo(
    () => employees.filter((e) => e.status === 'active' || e.status === 'pending'),
    [employees]
  );

  // The list response already carries each employee's latest-week score and the
  // tenant target, so the dashboard makes one request, not one per employee.
  const scoreFor = (emp) =>
    emp.latest_overall_score == null
      ? null
      : { overall_score: emp.latest_overall_score, target_score: emp.latest_target_score };

  // Sortable headers — the shared <Th> primitive (aria-sort, keyboard) used by
  // every other roster table. The default keeps the triage order: most advanced
  // probation first, records still awaiting assignment last.
  const [sort, setSort] = useState({ key: 'day', dir: 'desc' });
  const onSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  // One row per probationer: day/stage, score vs target, next milestone. A pending
  // record has no clock yet, so it renders as "Pending assignment" and sorts last.
  // A missing scorecard renders as "No score yet" rather than dropping the row.
  const rows = useMemo(
    () =>
      probationers
        .map((emp) => {
          const pending = emp.status === 'pending';
          const days = pending ? 0 : getDaysElapsed(emp.start_date);
          const next = pending ? null : nextMilestone(days);
          return {
            emp,
            pending,
            days,
            next,
            nextDate: next ? milestoneDate(emp.start_date, next) : null,
            capDate: emp.day_180_date,
            tone: pending ? null : milestoneFor(days, emp.status).tone,
            sc: scoreFor(emp),
          };
        })
        .sort((a, b) => {
          // A pending record has no clock and no milestone — always last.
          if (a.pending !== b.pending) return a.pending ? 1 : -1;
          const dir = sort.dir === 'asc' ? 1 : -1;
          if (sort.key === 'score') {
            // Unrated rows stay last regardless of direction (as in the roster).
            const av = a.sc ? Number(a.sc.overall_score) : null;
            const bv = b.sc ? Number(b.sc.overall_score) : null;
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            return dir * (av - bv);
          }
          if (sort.key === 'next') {
            // Past the Day 180 cap there is no next milestone — sort those last.
            const av = a.next ?? Number.POSITIVE_INFINITY;
            const bv = b.next ?? Number.POSITIVE_INFINITY;
            return dir * (av - bv);
          }
          if (sort.key === 'name') {
            const ka = (a.emp.user?.full_name || '').toLowerCase();
            const kb = (b.emp.user?.full_name || '').toLowerCase();
            return dir * (ka < kb ? -1 : ka > kb ? 1 : 0);
          }
          return dir * (a.days - b.days);
        }),
    [probationers, sort]
  );

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

  const targetScore = Number(rows[0]?.sc?.target_score) || 4.0;

  const kpis = [
    {
      label: 'Past cap',
      value: <CountUp value={stats.pastCap} />,
      caption: `Past Day ${PROBATION_DAYS} · constructive regularization`,
      // Colour carries status: a zero needs no red — no dot when nothing is past cap.
      tone: stats.pastCap > 0 ? 'bad' : undefined,
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

        {/* Probation status (day · score · next milestone) · pending interventions */}
        <Row className="lg:items-start">
          <Col span={7}>
            <section aria-label="Probation status">
              <SectionHead
                title="Probation status"
                subtitle={`Target ${targetScore.toFixed(1)}`}
              />
              {isEmpLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <p className="py-6 text-14 text-ink-3">No probationary employees yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <caption className="sr-only">
                      Probationary employees with their probation day, latest score and next
                      milestone
                    </caption>
                    <thead>
                      <tr className="border-b border-line">
                        <Th
                          sortKey="name"
                          activeKey={sort.key}
                          dir={sort.dir}
                          onSort={onSort}
                          className="py-2.5 pr-3"
                        >
                          Employee
                        </Th>
                        <Th
                          sortKey="day"
                          activeKey={sort.key}
                          dir={sort.dir}
                          onSort={onSort}
                          className="py-2.5 pr-3"
                        >
                          Probation
                        </Th>
                        <Th
                          sortKey="score"
                          activeKey={sort.key}
                          dir={sort.dir}
                          onSort={onSort}
                          align="right"
                          className="py-2.5 pr-3"
                        >
                          Score
                        </Th>
                        <Th
                          sortKey="next"
                          activeKey={sort.key}
                          dir={sort.dir}
                          onSort={onSort}
                          className="py-2.5"
                        >
                          Next
                        </Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map(({ emp, pending, days, tone, sc, next, nextDate, capDate }) => {
                        const score = sc ? Number(sc.overall_score) : null;
                        const target = sc ? Number(sc.target_score) || targetScore : targetScore;
                        const scoreVal = score != null ? scoreTone(score, target) : null;
                        return (
                          <tr key={emp.id}>
                            <td className="py-3 pr-3">
                              <Link
                                to={`/employees/${emp.id}`}
                                className="text-14 text-ink hover:underline"
                              >
                                {emp.user?.full_name}
                              </Link>
                            </td>
                            <td className="py-3 pr-3">
                              {pending ? (
                                <span className="text-14 text-ink-3">Pending assignment</span>
                              ) : (
                                <span className="flex items-center gap-2 whitespace-nowrap text-14 text-ink-2 font-num">
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[tone]}`}
                                    aria-hidden="true"
                                  />
                                  {formatProbationDay(days)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-3 text-right">
                              {sc ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="relative inline-block h-2 w-16 rounded-full bg-hover align-middle">
                                    <i
                                      className={`absolute inset-y-0 left-0 rounded-full ${TONE_FILL[scoreVal]}`}
                                      style={{ width: `${(score / 5) * 100}%` }}
                                    />
                                    <i
                                      className="absolute -top-1.5 -bottom-1.5 w-px bg-ink-3/60"
                                      style={{ left: `${(target / 5) * 100}%` }}
                                      title={`Target ${target.toFixed(1)}`}
                                    />
                                  </span>
                                  <span
                                    className={`font-num font-semibold text-14 ${TONE_TEXT[scoreVal]}`}
                                  >
                                    {score.toFixed(2)}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-14 text-ink-3">No score yet</span>
                              )}
                            </td>
                            <td className="py-3 text-12 text-ink-3">
                              {pending
                                ? 'Awaiting start date'
                                : next
                                ? `${MILE_LABEL[next]}, ${formatDayMonth(nextDate)}`
                                : `Passed ${formatDayMonth(capDate)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </Col>

          <Col span={5}>
            <section aria-label="Interventions">
              <SectionHead title="Interventions" />
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
                <>
                  <ul>
                    {plans.slice(0, 3).map((plan) => (
                      <li key={plan.id} className="border-t border-line py-3 first:border-t-0">
                        {plan.employee_name ? (
                          <div className="text-12 text-ink-3">{plan.employee_name}</div>
                        ) : null}
                        <div className="mt-0.5 text-14 font-semibold text-ink">
                          {plan.intervention_title}
                        </div>
                        <p className="mt-0.5 text-14 leading-relaxed text-ink-2">
                          {plan.rationale ||
                            (plan.custom_kpi_name
                              ? `Custom KPI: ${plan.custom_kpi_name}`
                              : plan.competency?.replace(/_/g, ' '))}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-line pt-3 mt-1">
                    <Link to={ROUTES.rollups.path} className="text-12 text-accent hover:underline">
                      View all {plans.length} pending
                    </Link>
                  </div>
                </>
              )}
            </section>
          </Col>
        </Row>
      </PageGrid>
    </Page>
  );
}
