import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, interventionApi, notificationApi } from '../../api';
import {
  Button,
  Skeleton,
  Card,
  Page,
  CountUp,
  SectionHead,
  StatBand,
  PageGrid,
  Row,
  Col,
  Th,
} from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDate, milestoneDate } from '../../utils/datetime';
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
} from '../../utils/status';
import { Users, Award, ChevronRight } from '../../components/icons';
import { useStatusBar } from '../../context/ChromeContext';

// Employer dashboard — the overview: KPI strip · score-vs-target chart + milestone
// alerts · next statutory deadlines + AI recommendations. Every value comes from
// the API/DB (scores via each employee's scorecard; no invented numbers).
const MILE_LABEL = {
  [MILESTONE_REVIEW]: `Day ${MILESTONE_REVIEW} review`,
  [MILESTONE_NOTICE]: `Day ${MILESTONE_NOTICE} notice`,
  [MILESTONE_CRITICAL]: `Day ${MILESTONE_CRITICAL} critical`,
  [PROBATION_DAYS]: `Day ${PROBATION_DAYS} cap`,
};

// Notification category → statutory tone (backend: milestone_150/165/178).
const ALERT_TONE = { milestone_150: 'warn', milestone_165: 'notice', milestone_178: 'bad' };

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

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationApi.list()) ?? [],
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

  const scores = useMemo(
    () =>
      activeProbationers
        .map((e, i) => ({ emp: e, sc: scoreQueries[i].data }))
        .filter((s) => s.sc)
        .sort((a, b) => Number(b.sc.overall_score) - Number(a.sc.overall_score)),
    [activeProbationers, scoreQueries]
  );
  const scoresLoading = scoreQueries.some((q) => q.isLoading);

  const stats = useMemo(() => {
    let pastCap = 0;
    let decisionsDue = 0;
    let onTrack = 0;
    activeProbationers.forEach((emp) => {
      const d = getDaysElapsed(emp.start_date);
      if (d > PROBATION_DAYS) pastCap += 1;
      else if (d >= MILESTONE_REVIEW) decisionsDue += 1;
      else onTrack += 1;
    });
    return {
      pastCap,
      decisionsDue,
      onTrack,
      pendingPlans: plans.filter((p) => p.status === 'pending_approval').length,
    };
  }, [activeProbationers, plans]);

  const targetScore = Number(scores[0]?.sc?.target_score) || 4.0;

  // Next deadlines — one row per active probationer, sorted by nearest date.
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('asc');
  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const deadlines = useMemo(() => {
    const list = activeProbationers.map((e) => {
      const days = getDaysElapsed(e.start_date);
      const next = nextMilestone(days) || PROBATION_DAYS;
      return { emp: e, days, next, past: days > PROBATION_DAYS, date: milestoneDate(e.start_date, next) };
    });
    list.sort((a, b) => {
      let r = 0;
      if (sortKey === 'name') r = (a.emp.user?.full_name || '').localeCompare(b.emp.user?.full_name || '');
      else if (sortKey === 'milestone') r = a.next - b.next;
      else r = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }, [activeProbationers, sortKey, sortDir]);

  const alerts = useMemo(
    () =>
      notifications
        .filter((n) => String(n.category || '').startsWith('milestone'))
        .slice(0, 3),
    [notifications]
  );

  useStatusBar(
    `Day 0–${PROBATION_DAYS} pipeline · ${activeProbationers.length} active · ${stats.decisionsDue} decisions due`,
    `${stats.pendingPlans} interventions pending · Asia/Manila`
  );

  return (
    <Page
      title="Dashboard"
      subtitle={
        <>
          Probationary pipeline · Article 296 · <span className="font-num">Asia/Manila</span>
        </>
      }
      actions={
        <>
          <Button variant="secondary" leftIcon={Users} onClick={() => navigate('/employees')}>
            Directory
          </Button>
          <Button variant="primary" leftIcon={Award} onClick={() => navigate('/supervisor/rate')}>
            Rate staff
          </Button>
        </>
      }
    >
      <PageGrid className="space-y-6 lg:space-y-0 lg:gap-y-6">
        {/* KPI strip */}
        <Row>
          <Col span={12}>
            <StatBand
              cells={[
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
                {
                  label: 'On track',
                  value: <CountUp value={stats.onTrack} />,
                  caption: `Below Day ${MILESTONE_REVIEW}`,
                  tone: 'ok',
                },
                {
                  label: 'Interventions pending',
                  value: <CountUp value={stats.pendingPlans} />,
                  caption: stats.pendingPlans === 0 ? 'None awaiting sign-off' : 'Awaiting sign-off',
                },
              ]}
            />
          </Col>
        </Row>

        {/* Overall score + Next deadlines (1–7) · Alerts + AI (8–12) */}
        <Row className="lg:items-start">
          <Col span={7} className="space-y-6">
            <Card flat padded={false} className="space-y-1">
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
                <p className="py-6 text-14 text-ink-3">No weekly ratings submitted yet.</p>
              ) : (
                <div>
                  {scores.map(({ emp, sc }) => {
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
                          className="w-32 shrink-0 truncate text-14 text-ink hover:underline"
                        >
                          {emp.user?.full_name}
                        </Link>
                        <span className="relative h-2 flex-1 rounded-full bg-hover">
                          <i
                            className={`absolute inset-y-0 left-0 rounded-full ${TONE_BG[tone]}`}
                            style={{ width: `${(score / 5) * 100}%` }}
                          />
                          <i
                            className="absolute -top-1 -bottom-1 w-px bg-ink-3/60"
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
            </Card>

            <Card flat padded={false} className="space-y-1">
              <SectionHead title="Next deadlines" subtitle="nearest statutory date per employee" />
              {isEmpLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : deadlines.length === 0 ? (
                <p className="py-6 text-14 text-ink-3">No active probationary employees.</p>
              ) : (
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">
                    Active probationers by their nearest statutory milestone
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      <Th sortKey="date" activeKey={sortKey} dir={sortDir} onSort={onSort} className="w-28 py-2.5 pr-4">
                        Date
                      </Th>
                      <Th sortKey="milestone" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 pr-4">
                        Milestone
                      </Th>
                      <Th sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5">
                        Employee
                      </Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {deadlines.map(({ emp, days, next, past, date }) => {
                      const tone = milestoneFor(days, emp.status).tone;
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => navigate(`/employees/${emp.id}`)}
                          className="cursor-pointer transition-colors hover:bg-hover"
                        >
                          <td className="py-3 pr-4 text-14 font-semibold font-num text-ink whitespace-nowrap">
                            {formatDate(date)}
                          </td>
                          <td className="py-3 pr-4 text-12 text-ink-2">
                            {past ? 'Past cap' : MILE_LABEL[next]}
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[tone]}`}
                                aria-hidden="true"
                              />
                              <Link
                                to={`/employees/${emp.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="truncate text-14 text-ink"
                              >
                                {emp.user?.full_name}
                              </Link>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </Col>

          <Col span={5} className="space-y-6">
            <Card flat padded={false} className="space-y-1">
              <SectionHead title="Alerts" subtitle="milestone notices" />
              {alerts.length === 0 ? (
                <p className="py-6 text-14 text-ink-3">No milestone alerts.</p>
              ) : (
                <div>
                  {alerts.map((n) => {
                    const tone = ALERT_TONE[n.category] || 'warn';
                    return (
                      <div key={n.id} className="flex items-start gap-2.5 border-t border-line py-3 first:border-t-0">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_BG[tone]}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="text-14 text-ink">{n.title}</div>
                          {n.body ? (
                            <div className="mt-0.5 text-12 leading-relaxed text-ink-2">{n.body}</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card flat padded={false} className="space-y-1">
              <SectionHead title="AI recommendations" subtitle="Random Forest gap classifier" />
              {isPlansLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : isPlansError ? (
                <p className="py-6 text-14 text-bad">
                  Unable to load AI recommendations right now. Please retry.
                </p>
              ) : plans.length === 0 ? (
                <p className="py-3 text-14 leading-relaxed text-ink-2">
                  All probationary employees are performing at or above benchmark. No active
                  intervention plans required.
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
            </Card>
          </Col>
        </Row>
      </PageGrid>
    </Page>
  );
}
