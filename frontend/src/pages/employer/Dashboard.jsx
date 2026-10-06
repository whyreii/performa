import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeApi, interventionApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button, Badge, StatusDot, MilestonePill, MilestoneComposition, Skeleton, Card, Page, CountUp, Split } from '../../components/ui';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { PROBATION_DAYS, MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL } from '../../config/domain';
import { milestoneTone } from '../../utils/status';
import { getInitials } from '../../utils/format';
import {
  ChevronRight,
  ArrowRight,
} from '../../components/icons';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Dispatch any due statutory milestone alerts (idempotent) on dashboard load.
  useEffect(() => {
    employeeApi
      .scanMilestones()
      .then((res) => {
        if (res?.fired) queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .catch(() => {});
  }, [queryClient]);

  // Fetch employees
  const { data: employees = [], isLoading: isEmpLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  // Fetch milestone report
  const { data: milestoneReport, isLoading: isMilestoneLoading } = useQuery({
    queryKey: ['milestones'],
    queryFn: () => employeeApi.getMilestones(),
  });

  // Fetch intervention plans
  const {
    data: plans = [],
    isLoading: isPlansLoading,
    isError: isPlansError,
  } = useQuery({
    queryKey: ['intervention-plans'],
    queryFn: () => interventionApi.listPending(),
  });

  const activeProbationers = useMemo(() => {
    return employees.filter((e) => e.status === 'active');
  }, [employees]);

  // Aggregate metrics
  const stats = useMemo(() => {
    const totalActive = activeProbationers.length;
    let day150Count = 0;
    let day165Count = 0;
    let day178Count = 0;

    activeProbationers.forEach((emp) => {
      const days = getDaysElapsed(emp.start_date);
      const tone = milestoneTone(days);
      if (tone === 'bad') day178Count += 1;
      else if (tone === 'notice') day165Count += 1;
      else if (tone === 'warn') day150Count += 1;
    });

    const pendingPlans = plans.filter((p) => p.status === 'pending_approval').length;

    return {
      totalActive,
      criticalMilestones: day150Count + day165Count + day178Count,
      day150Count,
      day165Count,
      day178Count,
      pendingPlans,
    };
  }, [activeProbationers, plans]);

  // Identify high-urgency probationers (at or beyond Day 150)
  // Cohort health: on-track is everyone not yet at a milestone threshold.
  const onTrackCount = Math.max(0, stats.totalActive - stats.criticalMilestones);

  return (
    <Page
        title="Dashboard"
        subtitle={
          <>
            Probationary pipeline · <span className="font-num text-ink">{user?.organization_name || user?.organization_id}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/employees')}>
              Directory
            </Button>
            <Button variant="primary" onClick={() => navigate('/supervisor/rate')}>
              Rate Staff
            </Button>
          </>
        }
    >

      {/* 1. Top Metrics Cards — Option 1: label → metric → caption (no icons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Probationers */}
        <Card as="div" padded={false} className="p-5 flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">Active Probationers</span>
          <div className="flex items-baseline gap-2">
            <span className="text-30 font-bold font-num text-ink">
              <CountUp value={stats.totalActive} />
            </span>
            <span className="text-12 text-ink-3">staff members</span>
          </div>
          <p className="text-12 text-ink-2">Under {PROBATION_DAYS}-day evaluation</p>
        </Card>

        {/* Milestone Alerts — tone number only when the count signals action */}
        <Card as="div" padded={false} className="p-5 flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">Milestone Alerts</span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-30 font-bold font-num ${
                stats.criticalMilestones > 0 ? 'text-warn' : 'text-ink'
              }`}
            >
              <CountUp value={stats.criticalMilestones} />
            </span>
            <span className="text-12 text-ink-3">action items</span>
          </div>
          <p className="text-12 text-ink-2">
            Day {MILESTONE_REVIEW} · {MILESTONE_NOTICE} · {MILESTONE_CRITICAL} thresholds
          </p>
        </Card>

        {/* Regularizing Benchmark */}
        <Card as="div" padded={false} className="p-5 flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">Regularizing Target</span>
          <div className="flex items-baseline gap-2">
            <span className="text-30 font-bold font-num text-ink">
              <CountUp value={4} decimals={1} />
            </span>
            <span className="text-12 text-ink-3">/ 5.0 passing</span>
          </div>
          <p className="text-12 text-ink-2">Across 5 legal competencies</p>
        </Card>

        {/* AI Training Plans */}
        <Card as="div" padded={false} className="p-5 flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">AI Training Plans</span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-30 font-bold font-num ${
                (stats.pendingPlans ?? plans.length) === 0 ? 'text-ok' : 'text-ink'
              }`}
            >
              <CountUp value={stats.pendingPlans ?? plans.length} />
            </span>
            <span className="text-12 text-ink-3">
              {(stats.pendingPlans ?? plans.length) === 0
                ? 'all meeting benchmarks'
                : 'courses recommended'}
            </span>
          </div>
          <p className="text-12 text-ink-2">
            {(stats.pendingPlans ?? plans.length) === 0
              ? 'No interventions required'
              : 'ML Random Forest gap classifier'}
          </p>
        </Card>
      </div>

      {/* Dynamic grid: the Pipeline is the work surface (main column); the AI
          training plans are the context rail (sticky on desktop, stacked below
          the pipeline on mobile). */}
      <Split
        main={
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-16 font-semibold text-ink">Pipeline</h2>
            <p className="text-12 text-ink-3">Live timeline progress tracking toward Day {PROBATION_DAYS}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/employees')}
          >
            View All ({activeProbationers.length})
          </Button>
        </div>

        {/* Cohort composition — a calm, read-only breakdown (absorbed the old
            urgent banner). Colour = status; no filter, no hidden interactions. */}
        {!isEmpLoading && activeProbationers.length > 0 && (
          <MilestoneComposition
            total={stats.totalActive}
            onTrack={onTrackCount}
            review={stats.day150Count}
            notice={stats.day165Count}
            critical={stats.day178Count}
            action={
              stats.criticalMilestones > 0 ? (
                <Button variant="secondary" size="sm" rightIcon={ArrowRight} onClick={() => navigate('/employees')}>
                  Review urgent staff
                </Button>
              ) : null
            }
          />
        )}

        {isEmpLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : activeProbationers.length === 0 ? (
          <div className="py-8 text-center text-12 text-ink-3">
            No active probationary employees in the current tenant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">
                Active probationers pipeline with {PROBATION_DAYS}-day tracker and milestone
              </caption>
              <thead>
                <tr className="border-b border-line text-12 font-medium text-ink-3 uppercase tracking-wider bg-hover/40">
                  <th scope="col" className="py-2.5 px-3">Employee</th>
                  <th scope="col" className="py-2.5 px-3">Department</th>
                  <th scope="col" className="py-2.5 px-3">{PROBATION_DAYS}-Day Tracker</th>
                  <th scope="col" className="py-2.5 px-3">Milestone</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-12">
                {activeProbationers.map((emp) => {
                  const days = getDaysElapsed(emp.start_date);
                  const progressPct = Math.min(100, Math.round((days / PROBATION_DAYS) * 100));

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="hover:bg-hover cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent/15 text-accent font-semibold text-12 flex items-center justify-center shrink-0">
                            {getInitials(emp.user?.full_name)}
                          </div>
                          <div>
                            <Link
                              to={`/employees/${emp.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-ink block truncate"
                            >
                              {emp.user?.full_name}
                            </Link>
                            <span className="text-12 text-ink-3 block font-num">
                              {emp.job_title}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-ink-2">{emp.department}</td>

                      <td className="py-3 px-3 min-w-[150px]">
                        <div className="space-y-1">
                          <div className="flex justify-between font-num text-12 text-ink-2">
                            <span>Day {days}</span>
                            <span className="text-ink-3">{Math.max(0, PROBATION_DAYS - days)}d left</span>
                          </div>
                          <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all bg-ink-3"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <MilestonePill daysElapsed={days} status={emp.status} />
                      </td>

                      <td className="py-3 px-3 text-right">
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
        }
        aside={
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-16 font-semibold text-ink">AI Training Plans</h2>
            <p className="text-12 text-ink-3">
              Random Forest gap classifier · pending approval
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => navigate('/rollups')}
          >
            Review All
          </Button>
        </div>

        {isPlansLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isPlansError ? (
          <div className="py-8 text-center text-12 text-bad">
            Unable to load AI training recommendations right now. Please retry.
          </div>
        ) : plans.length === 0 ? (
          <div className="py-8 text-center text-12 text-ink-3">
            All probationary employees are performing at or above benchmark. No active intervention plans required.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {plans.slice(0, 3).map((plan) => {
              const tone =
                plan.status === 'approved'
                  ? 'text-good'
                  : plan.status === 'rejected'
                  ? 'text-bad'
                  : 'text-ink-3';
              return (
                <div key={plan.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-14 font-medium text-ink truncate">
                      {plan.intervention_title}
                    </span>
                    <span className="font-num text-12 text-ink-3 shrink-0">
                      {plan.default_timeline || '—'}
                    </span>
                  </div>
                  <p className="text-12 text-ink-2 mt-1 line-clamp-2">
                    {plan.rationale || plan.competency?.replace(/_/g, ' ')}
                  </p>
                  <span className={`text-12 mt-1 inline-block capitalize ${tone}`}>
                    {plan.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
          </Card>
        }
      />
    </Page>
  );
}
