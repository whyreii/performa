import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button, Badge, MilestonePill, StatusDot, Skeleton } from '../../components/ui';
import {
  Users,
  Award,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Target,
  CheckCircle2,
} from 'lucide-react';

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

  const getDaysElapsed = (startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  };

  const activeProbationers = useMemo(() => {
    return employees.filter((e) => e.status === 'active');
  }, [employees]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Supervisor Workspace
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Weekly Evaluator Dashboard · <span className="font-mono text-ink">Acme PH</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => navigate('/supervisor/rubrics')}
          >
            KPI Rubrics
          </Button>
          <Button
            variant="primary"
            leftIcon={Award}
            onClick={() => navigate('/supervisor/rate')}
          >
            Rate Staff
          </Button>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-ctl bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>Direct Reports</span>
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">
            {activeProbationers.length}
          </div>
          <p className="text-[11px] text-ink-2">Assigned probationary staff</p>
        </div>

        <div className="p-5 rounded-ctl bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>Passing Target</span>
            <Target className="w-4 h-4 text-ok" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">4.0 / 5.0</div>
          <p className="text-[11px] text-ink-2">Statutory regularizing standard</p>
        </div>

        <div className="p-5 rounded-ctl bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>Review Frequency</span>
            <Calendar className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">Weekly</div>
          <p className="text-[11px] text-ink-2">Mandatory evidentiary due process</p>
        </div>
      </div>

      {/* Assigned Probationers Table */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">Assigned Probationary Staff</h2>
            <p className="text-xs text-ink-3">Weekly evaluation schedule & milestone tracking</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : activeProbationers.length === 0 ? (
          <div className="py-10 text-center space-y-2 text-ink-3">
            <Users className="w-8 h-8 mx-auto text-ink-3/40" />
            <p className="text-xs">No active probationary staff assigned to your workspace.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {activeProbationers.map((emp) => {
              const days = getDaysElapsed(emp.start_date);
              const progressPct = Math.min(100, Math.round((days / 180) * 100));

              return (
                <div
                  key={emp.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-hover/50 px-2 rounded-ctl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/15 text-accent font-semibold text-xs flex items-center justify-center shrink-0">
                      {getInitials(emp.user?.full_name)}
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-ink block">
                        {emp.user?.full_name}
                      </span>
                      <span className="text-xs text-ink-3 block">
                        {emp.job_title} · {emp.department}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                    <div className="min-w-[130px] space-y-1">
                      <div className="flex justify-between font-mono text-[11px] text-ink-2">
                        <span>Day {days}</span>
                        <span className="text-ink-3">{Math.max(0, 180 - days)}d left</span>
                      </div>
                      <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            days >= 178 ? 'bg-bad' : days >= 150 ? 'bg-warn' : 'bg-accent'
                          }`}
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
      </section>
    </div>
  );
}
