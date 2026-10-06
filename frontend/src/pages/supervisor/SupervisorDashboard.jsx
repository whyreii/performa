import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button, Badge, MilestonePill, StatusDot, Skeleton, EmptyState, Card, Page } from '../../components/ui';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { PROBATION_DAYS, MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL } from '../../config/domain';
import { getInitials } from '../../utils/format';
import {
  Users,
  Award,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
} from '../../components/icons';

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
            <Button variant="secondary" onClick={() => navigate('/supervisor/rubrics')}>
              KPI Rubrics
            </Button>
            <Button variant="primary" leftIcon={Award} onClick={() => navigate('/supervisor/rate')}>
              Rate Staff
            </Button>
          </>
        }
    >

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card as="div" padded={false} className="p-5 space-y-2">
          <span className="text-12 text-ink-3">Direct Reports</span>
          <div className="text-22 font-bold font-num text-ink">
            {activeProbationers.length}
          </div>
          <p className="text-12 text-ink-2">Assigned probationary staff</p>
        </Card>

        <Card as="div" padded={false} className="p-5 space-y-2">
          <span className="text-12 text-ink-3">Passing Target</span>
          <div className="text-22 font-bold font-num text-ink">4.0 / 5.0</div>
          <p className="text-12 text-ink-2">Statutory regularizing standard</p>
        </Card>

        <Card as="div" padded={false} className="p-5 space-y-2">
          <span className="text-12 text-ink-3">Review Frequency</span>
          <div className="text-22 font-bold font-num text-ink">Weekly</div>
          <p className="text-12 text-ink-2">Mandatory evidentiary due process</p>
        </Card>
      </div>

      {/* Assigned Probationers Table */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-16 font-semibold text-ink">Assigned Probationary Staff</h2>
            <p className="text-12 text-ink-3">Weekly evaluation schedule & milestone tracking</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
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
          <div className="divide-y divide-line">
            {activeProbationers.map((emp) => {
              const days = getDaysElapsed(emp.start_date);
              const progressPct = Math.min(100, Math.round((days / PROBATION_DAYS) * 100));

              return (
                <div
                  key={emp.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-hover/50 px-2 rounded-ctl transition-colors"
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
                    <div className="min-w-[130px] space-y-1">
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

                    <MilestonePill daysElapsed={days} status={emp.status} />

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
      </Card>
    </Page>
  );
}
