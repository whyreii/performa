import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, interventionApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button, MilestonePill, Skeleton, EmptyState, Page, SectionHead, StatBand } from '../../components/ui';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { PROBATION_DAYS, TARGET, MILESTONE_REVIEW, COMPETENCIES } from '../../config/domain';
import { getInitials } from '../../utils/format';
import { Users, Award, AlertTriangle, BookOpen } from '../../components/icons';

const LABEL_BY_KEY = Object.fromEntries(COMPETENCIES.map((c) => [c.key, c.label]));
const competencyLabel = (key) => LABEL_BY_KEY[key] || key?.replace(/_/g, ' ') || '';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch employees list (FastAPI filters by supervisor assignment for supervisor role)
  const {
    data: employees = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const activeProbationers = useMemo(() => {
    return employees.filter((e) => e.status === 'active');
  }, [employees]);

  const atMilestone = useMemo(
    () => activeProbationers.filter((e) => getDaysElapsed(e.start_date) >= MILESTONE_REVIEW).length,
    [activeProbationers]
  );

  // AI training recommendations for this supervisor's team (view-only; the
  // endpoint is already scoped to the supervisor's direct reports).
  const { data: pendingPlans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ['pending-interventions'],
    queryFn: async () => (await interventionApi.listPending()) || [],
  });

  return (
    <Page
        title="Supervisor Workspace"
        subtitle={
          <>
            Weekly Evaluator Dashboard · <span className="font-num text-ink">{user?.organization_name || user?.organization_id}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/rubrics')}>
              KPI Rubrics
            </Button>
            <Button variant="primary" leftIcon={Award} onClick={() => navigate('/supervisor/rate')}>
              Rate Staff
            </Button>
          </>
        }
    >
      <StatBand
        cells={[
          {
            label: 'Direct reports',
            value: activeProbationers.length,
            caption: 'Assigned to you',
            tone: 'ok',
          },
          {
            label: `At or past Day ${MILESTONE_REVIEW}`,
            value: atMilestone,
            caption: `Regularizing standard ${TARGET.toFixed(1)} / 5.0 · Article 296`,
            tone: atMilestone ? 'warn' : undefined,
          },
        ]}
      />

      {/* Assigned probationers — flat rows, hairline-separated */}
      <section aria-label="Assigned probationary staff">
        <SectionHead
          title="Assigned probationary staff"
          subtitle="Weekly evaluation schedule & milestone tracking"
        />

        {isLoading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-bad" />
            <p className="text-12 text-bad">
              {getApiErrorMessage(error, 'Failed to load your assigned employees.')}
            </p>
          </div>
        ) : activeProbationers.length === 0 ? (
          <EmptyState icon={Users} title="No active probationary staff">
            No active probationary staff assigned to your workspace.
          </EmptyState>
        ) : (
          <div>
            {activeProbationers.map((emp) => {
              const days = getDaysElapsed(emp.start_date);
              const progressPct = Math.min(100, Math.round((days / PROBATION_DAYS) * 100));

              return (
                <div
                  key={emp.id}
                  className="border-t border-line py-4 first:border-t-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-accent/15 text-accent font-semibold text-12 flex items-center justify-center shrink-0">
                      {getInitials(emp.user?.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-14 text-ink block truncate">
                        {emp.user?.full_name}
                      </span>
                      <span className="text-12 text-ink-3 block truncate">
                        {emp.job_title} · {emp.department}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap shrink-0">
                    <div className="w-[130px] space-y-1">
                      <div className="flex justify-between font-num text-12 text-ink-2">
                        <span>Day {days}</span>
                        <span className="text-ink-3">{Math.max(0, PROBATION_DAYS - days)}d left</span>
                      </div>
                      <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] bg-ink-3"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-[208px] flex items-center">
                      <MilestonePill daysElapsed={days} status={emp.status} />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/employees/${emp.id}`)}
                      >
                        Scorecard
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={Award}
                        onClick={() => navigate(`/supervisor/rate?employee=${emp.id}`)}
                      >
                        Rate
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Training recommendations — AI-generated for the team, view-only */}
      <section aria-label="Training recommendations">
        <SectionHead
          title="Training recommendations"
          subtitle="AI-generated for your team · view-only"
        />
        {isPlansLoading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : pendingPlans.length === 0 ? (
          <EmptyState icon={BookOpen} title="No training recommendations">
            AI training recommendations for your team will appear here once the employer runs a monthly rollup.
          </EmptyState>
        ) : (
          <div>
            {pendingPlans.map((plan) => (
              <div key={plan.id} className="border-t border-line py-4 first:border-t-0 space-y-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-14 font-semibold text-ink">{plan.intervention_title}</span>
                  <span className="text-12 text-ink-3">
                    {competencyLabel(plan.competency)}
                    {plan.intervention_type ? ` · ${plan.intervention_type}` : ''}
                  </span>
                </div>
                {plan.rationale && (
                  <p className="text-14 text-ink-2 leading-relaxed">{plan.rationale}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
