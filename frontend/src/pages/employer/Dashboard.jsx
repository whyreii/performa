import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeApi, interventionApi, getApiErrorMessage } from '../../api';
import { Button, Badge, ScoreMeter, StatusDot, MilestonePill, Skeleton, Card, Page, Surface } from '../../components/ui';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { PROBATION_DAYS, MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL } from '../../config/domain';
import { getInitials } from '../../utils/format';
import {
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

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
      if (days >= MILESTONE_CRITICAL) day178Count += 1;
      else if (days >= MILESTONE_NOTICE) day165Count += 1;
      else if (days >= MILESTONE_REVIEW) day150Count += 1;
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
  const urgentProbationers = useMemo(() => {
    return activeProbationers
      .map((emp) => ({
        ...emp,
        daysElapsed: getDaysElapsed(emp.start_date),
      }))
      .filter((emp) => emp.daysElapsed >= MILESTONE_REVIEW)
      .sort((a, b) => b.daysElapsed - a.daysElapsed);
  }, [activeProbationers]);

  return (
    <Page
        title="Dashboard"
        subtitle={
          <>
            Probationary pipeline · <span className="font-mono text-ink">Acme PH</span>
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
        <div className="p-5 rounded-ctl bg-surface border border-line flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">Active Probationers</span>
          <div className="flex items-baseline gap-2">
            <span className="text-30 font-bold font-mono text-ink">{stats.totalActive}</span>
            <span className="text-12 text-ink-3">staff members</span>
          </div>
          <p className="text-12 text-ink-2">Under {PROBATION_DAYS}-day evaluation</p>
        </div>

        {/* Milestone Alerts — tone number only when the count signals action */}
        <div className="p-5 rounded-ctl bg-surface border border-line flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">Milestone Alerts</span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-30 font-bold font-mono ${
                stats.criticalMilestones > 0 ? 'text-warn' : 'text-ink'
              }`}
            >
              {stats.criticalMilestones}
            </span>
            <span className="text-12 text-ink-3">action items</span>
          </div>
          <p className="text-12 text-ink-2">
            Day {MILESTONE_REVIEW} · {MILESTONE_NOTICE} · {MILESTONE_CRITICAL} thresholds
          </p>
        </div>

        {/* Regularizing Benchmark */}
        <div className="p-5 rounded-ctl bg-surface border border-line flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">Regularizing Target</span>
          <div className="flex items-baseline gap-2">
            <span className="text-30 font-bold font-mono text-ink">4.0</span>
            <span className="text-12 text-ink-3">/ 5.0 passing</span>
          </div>
          <p className="text-12 text-ink-2">Across 5 legal competencies</p>
        </div>

        {/* AI Training Plans */}
        <div className="p-5 rounded-ctl bg-surface border border-line flex flex-col gap-2">
          <span className="text-14 font-semibold text-ink">AI Training Plans</span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-30 font-bold font-mono ${
                (stats.pendingPlans ?? plans.length) === 0 ? 'text-ok' : 'text-ink'
              }`}
            >
              {stats.pendingPlans ?? plans.length}
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
        </div>
      </div>

      {/* 2. Critical Milestones Banner (If any probationers >= Day 150) */}
      {/* Reserve the banner slot while employees load so its mount does not shift the page. */}
      {isEmpLoading && <Skeleton className="h-[78px] w-full" />}
      {!isEmpLoading && urgentProbationers.length > 0 && (
        <Surface as="section" tone="warn" className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  {urgentProbationers.length} to review
                </h2>
                <p className="text-xs text-ink-2">
                  Day {MILESTONE_REVIEW} · {MILESTONE_NOTICE} · {MILESTONE_CRITICAL} under Art. 296 — decisions due before Day {PROBATION_DAYS}.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              rightIcon={ArrowRight}
              onClick={() => navigate('/employees')}
            >
              Review now
            </Button>
          </div>
        </Surface>
      )}

      {/* 3. Active Probationers Pipeline Table */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">Pipeline</h2>
            <p className="text-xs text-ink-3">Live timeline progress tracking toward Day {PROBATION_DAYS}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/employees')}
          >
            View All ({activeProbationers.length})
          </Button>
        </div>

        {isEmpLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : activeProbationers.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
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
              <tbody className="divide-y divide-line text-xs">
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
                            <span className="text-12 text-ink-3 block font-mono">
                              {emp.job_title}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-ink-2">{emp.department}</td>

                      <td className="py-3 px-3 min-w-[150px]">
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-12 text-ink-2">
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

      {/* 4. AI Interventions & ML Course Recommendations Preview */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">AI Training Recommendations & Rollups</h2>
            <p className="text-xs text-ink-3">
              Automated Random Forest course assignments for identified competency gaps
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
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
          <div className="py-8 text-center text-xs text-bad">
            Unable to load AI training recommendations right now. Please retry.
          </div>
        ) : plans.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
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
                    <span className="font-mono text-12 text-ink-3 shrink-0">
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
    </Page>
  );
}
