import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeApi, interventionApi } from '../../api';
import { Button, Skeleton, Card, Page, CountUp } from '../../components/ui';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { PROBATION_DAYS, MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL } from '../../config/domain';
import { milestoneTone, milestoneFor, TONE_TEXT } from '../../utils/status';
import { Users, Award, ChevronRight } from '../../components/icons';

// Employer dashboard — "refined" layout: a flat hairline stat band over a stack
// of panels (action required → probationary employees → AI recommendations).
// Colour = status only; every value comes from the API/DB (no score column —
// the employee list carries no score, so we don't invent one).
const URGENT_MESSAGE = {
  bad: `Working past Day ${PROBATION_DAYS} confers automatic regular status under Article 296. Record a decision or issue written notice.`,
  notice: `Within the Day ${MILESTONE_NOTICE} written-notice window. Prepare the regularization decision.`,
  warn: `The Day ${MILESTONE_REVIEW} performance appraisal is due.`,
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

  const stats = useMemo(() => {
    let day150 = 0;
    let day165 = 0;
    let day178 = 0;
    activeProbationers.forEach((emp) => {
      const tone = milestoneTone(getDaysElapsed(emp.start_date));
      if (tone === 'bad') day178 += 1;
      else if (tone === 'notice') day165 += 1;
      else if (tone === 'warn') day150 += 1;
    });
    return {
      totalActive: activeProbationers.length,
      criticalMilestones: day150 + day165 + day178,
      pendingPlans: plans.filter((p) => p.status === 'pending_approval').length,
    };
  }, [activeProbationers, plans]);

  // The single most urgent active employee (greatest day count).
  const urgent = useMemo(() => {
    if (activeProbationers.length === 0) return null;
    const top = activeProbationers.reduce((best, emp) =>
      getDaysElapsed(emp.start_date) > getDaysElapsed(best.start_date) ? emp : best
    );
    const days = getDaysElapsed(top.start_date);
    return { emp: top, days, tone: milestoneTone(days) };
  }, [activeProbationers]);

  const showUrgent = urgent && urgent.tone !== 'ok';

  return (
    <Page
      kicker="Employer oversight"
      title="Dashboard"
      subtitle={<>Probationary pipeline · Article 296 · <span className="font-num">Asia/Manila</span></>}
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
      {/* Stat band — flat, hairline-divided (not boxed cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border-y border-line">
        <div className="bg-bg px-5 py-4">
          <div className="text-12 text-ink-3">Active probationers</div>
          <div className="font-num text-30 font-semibold text-ink mt-2">
            <CountUp value={stats.totalActive} />
          </div>
          <div className="text-12 text-ink-2 mt-2">Under {PROBATION_DAYS}-day evaluation</div>
        </div>
        <div className="bg-bg px-5 py-4">
          <div className="text-12 text-ink-3">Milestone alerts</div>
          <div
            className={`font-num text-30 font-semibold mt-2 ${
              stats.criticalMilestones > 0 ? 'text-warn' : 'text-ink'
            }`}
          >
            <CountUp value={stats.criticalMilestones} />
          </div>
          <div className="text-12 text-ink-2 mt-2">
            Day {MILESTONE_REVIEW} · {MILESTONE_NOTICE} · {MILESTONE_CRITICAL}
          </div>
        </div>
        <div className="bg-bg px-5 py-4">
          <div className="text-12 text-ink-3">Regularizing target</div>
          <div className="font-num text-30 font-semibold text-ink mt-2">
            <CountUp value={4} decimals={1} />
          </div>
          <div className="text-12 text-ink-2 mt-2">Across 5 competencies</div>
        </div>
        <div className="bg-bg px-5 py-4">
          <div className="text-12 text-ink-3">Pending interventions</div>
          <div
            className={`font-num text-30 font-semibold mt-2 ${
              stats.pendingPlans === 0 ? 'text-good' : 'text-ink'
            }`}
          >
            <CountUp value={stats.pendingPlans} />
          </div>
          <div className="text-12 text-ink-2 mt-2">
            {stats.pendingPlans === 0 ? 'None awaiting sign-off' : 'Awaiting sign-off'}
          </div>
        </div>
      </div>

      {/* Action required before Day 180 */}
      {showUrgent && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-16 font-semibold text-ink">Action required before Day {PROBATION_DAYS}</h2>
            <p className="text-12 text-ink-3 mt-0.5 font-num">
              {urgent.emp.user?.full_name} · Day {urgent.days}
            </p>
          </div>
          <p className="text-14 text-ink-2 leading-relaxed">
            <span className={`font-semibold ${TONE_TEXT[urgent.tone]}`}>
              {milestoneFor(urgent.days, 'active').label}
            </span>{' '}
            {URGENT_MESSAGE[urgent.tone]}
          </p>
        </Card>
      )}

      {/* Probationary employees */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-16 font-semibold text-ink">Probationary employees</h2>
          <p className="text-12 text-ink-3 mt-0.5">Weekly evaluation schedule</p>
        </div>

        {isEmpLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : activeProbationers.length === 0 ? (
          <p className="py-8 text-center text-14 text-ink-3">
            No active probationary employees in the current tenant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <caption className="sr-only">
                Active probationers with day count and statutory milestone
              </caption>
              <thead>
                <tr className="border-b border-line text-12 font-medium text-ink-3 uppercase tracking-wider">
                  <th scope="col" className="py-2.5 pr-4 w-[40%]">Employee</th>
                  <th scope="col" className="py-2.5 pr-4 w-[14%]">Day</th>
                  <th scope="col" className="py-2.5 pr-4 w-[38%]">Milestone</th>
                  <th scope="col" className="py-2.5 w-[8%] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activeProbationers.map((emp) => {
                  const days = getDaysElapsed(emp.start_date);
                  const { tone, label } = milestoneFor(days, emp.status);
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="hover:bg-hover cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          to={`/employees/${emp.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-14 text-ink truncate block"
                        >
                          {emp.user?.full_name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-num text-14 text-ink">{days}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-14 font-semibold ${TONE_TEXT[tone]}`}>{label}</span>
                      </td>
                      <td className="py-3 text-right">
                        <ChevronRight className="w-4 h-4 text-ink-3 inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* AI recommendations */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-16 font-semibold text-ink">AI recommendations</h2>
          <p className="text-12 text-ink-3 mt-0.5">Random Forest gap classifier</p>
        </div>

        {isPlansLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isPlansError ? (
          <p className="py-6 text-center text-14 text-bad">
            Unable to load AI recommendations right now. Please retry.
          </p>
        ) : plans.length === 0 ? (
          <p className="text-14 text-ink-2">
            All probationary employees are performing at or above benchmark. No active
            intervention plans required.
          </p>
        ) : (
          <ul className="space-y-3">
            {plans.slice(0, 3).map((plan) => (
              <li key={plan.id} className="border-l-2 border-accent pl-3">
                <div className="text-14 font-semibold text-ink">{plan.intervention_title}</div>
                <p className="text-14 text-ink-2 mt-0.5 leading-relaxed">
                  {plan.rationale || plan.competency?.replace(/_/g, ' ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
