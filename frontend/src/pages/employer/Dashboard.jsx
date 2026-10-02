import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, interventionApi, getApiErrorMessage } from '../../api';
import { Button, Badge, ScoreMeter, StatusDot, MilestonePill, Skeleton } from '../../components/ui';
import {
  Users,
  AlertTriangle,
  Award,
  FileCheck2,
  Calendar,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

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
  const { data: plans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ['intervention-plans'],
    queryFn: () => interventionApi.listPlans(),
  });

  // Manila days elapsed calculation
  const getDaysElapsed = (startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  };

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
      if (days >= 178) day178Count += 1;
      else if (days >= 165) day165Count += 1;
      else if (days >= 150) day150Count += 1;
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
      .filter((emp) => emp.daysElapsed >= 150)
      .sort((a, b) => b.daysElapsed - a.daysElapsed);
  }, [activeProbationers]);

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
            Executive Overview
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Probationary Pipeline & Statutory Due Process Tracker ·{' '}
            <span className="font-mono text-ink">Acme PH</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/employees')}
          >
            Directory
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/supervisor/rate')}
          >
            Rate Staff
          </Button>
        </div>
      </header>

      {/* 1. Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Probationers */}
        <div className="p-5 rounded-ctl bg-surface border border-line shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium">Active Probationers</span>
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-ink">
              {stats.totalActive}
            </span>
            <span className="text-xs text-ink-3">staff members</span>
          </div>
          <p className="text-[11px] text-ink-2">Under 180-day evaluation</p>
        </div>

        {/* Milestone Warnings */}
        <div className="p-5 rounded-ctl bg-surface border border-line shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium">Milestone Alerts</span>
            <AlertTriangle className="w-4 h-4 text-warn" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-bold font-mono ${
                stats.criticalMilestones > 0 ? 'text-warn' : 'text-ink'
              }`}
            >
              {stats.criticalMilestones}
            </span>
            <span className="text-xs text-ink-3">action items</span>
          </div>
          <p className="text-[11px] text-ink-2">Day 150 · 165 · 178 thresholds</p>
        </div>

        {/* Regularizing Benchmark */}
        <div className="p-5 rounded-ctl bg-surface border border-line shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium">Regularizing Target</span>
            <Award className="w-4 h-4 text-ok" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-ink">4.0</span>
            <span className="text-xs text-ink-3">/ 5.0 passing</span>
          </div>
          <p className="text-[11px] text-ink-2">Across 5 legal competencies</p>
        </div>

        {/* Pending AI Plans */}
        <div className="p-5 rounded-ctl bg-surface border border-line shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium">AI Training Plans</span>
            <FileCheck2 className="w-4 h-4 text-accent" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-ink">
              {stats.pendingPlans || plans.length}
            </span>
            <span className="text-xs text-ink-3">courses recommended</span>
          </div>
          <p className="text-[11px] text-ink-2">ML Random Forest gap classifier</p>
        </div>
      </div>

      {/* 2. Critical Milestones Banner (If any probationers >= Day 150) */}
      {urgentProbationers.length > 0 && (
        <section className="bg-warn/10 border border-warn/30 rounded-float p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-warn shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Article 296 Statutory Milestone Action Required
                </h3>
                <p className="text-xs text-ink-2">
                  {urgentProbationers.length} probationary employee(s) have reached or passed statutory review deadlines.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/employees')}
            >
              Review All
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {urgentProbationers.map((emp) => (
              <div
                key={emp.id}
                onClick={() => navigate(`/employees/${emp.id}`)}
                className="p-3 rounded-ctl bg-surface border border-line hover:border-accent cursor-pointer transition-all space-y-1.5 shadow-xs"
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-xs text-ink truncate block">
                    {emp.user?.full_name}
                  </span>
                  <MilestonePill daysElapsed={emp.daysElapsed} status={emp.status} />
                </div>
                <div className="flex justify-between text-[11px] text-ink-3 font-mono">
                  <span>{emp.department}</span>
                  <span>{Math.max(0, 180 - emp.daysElapsed)} days to Day 180</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Active Probationers Pipeline Table */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">Active Probationary Pipeline</h2>
            <p className="text-xs text-ink-3">Live timeline progress tracking toward Day 180</p>
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
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : activeProbationers.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
            No active probationary employees in the current tenant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-medium text-ink-3 uppercase tracking-wider bg-hover/40">
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">180-Day Tracker</th>
                  <th className="py-2.5 px-3">Milestone</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {activeProbationers.map((emp) => {
                  const days = getDaysElapsed(emp.start_date);
                  const progressPct = Math.min(100, Math.round((days / 180) * 100));

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="hover:bg-hover cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-accent/15 text-accent font-semibold text-[11px] flex items-center justify-center shrink-0">
                            {getInitials(emp.user?.full_name)}
                          </div>
                          <div>
                            <span className="font-semibold text-ink block truncate">
                              {emp.user?.full_name}
                            </span>
                            <span className="text-[11px] text-ink-3 block font-mono">
                              {emp.job_title}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-ink-2">{emp.department}</td>

                      <td className="py-3 px-3 min-w-[150px]">
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[11px] text-ink-2">
                            <span>Day {days}</span>
                            <span className="text-ink-3">{Math.max(0, 180 - days)}d left</span>
                          </div>
                          <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                days >= 178
                                  ? 'bg-bad'
                                  : days >= 150
                                  ? 'bg-warn'
                                  : 'bg-accent'
                              }`}
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
      </section>

      {/* 4. AI Interventions & ML Course Recommendations Preview */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span>AI Training Recommendations & Rollups</span>
            </h2>
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
          <Skeleton className="h-20 w-full" />
        ) : plans.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
            All probationary employees are performing at or above benchmark. No active intervention plans required.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.slice(0, 3).map((plan) => (
              <div
                key={plan.id}
                className="p-3.5 rounded-ctl bg-hover/60 border border-line space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Badge variant={plan.status === 'completed' ? 'ok' : 'accent'}>
                    {plan.status?.replace('_', ' ')}
                  </Badge>
                  <span className="font-mono text-[11px] text-ink-3">
                    Est: {plan.estimated_hours || 4}h
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-xs text-ink block truncate">
                    {plan.course_name}
                  </span>
                  <p className="text-[11px] text-ink-2 line-clamp-2 mt-0.5">
                    {plan.rationale}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
