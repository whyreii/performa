import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, getApiErrorMessage } from '../../api';
import { Badge, Skeleton } from '../../components/ui';
import { Users, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

export default function AdminOverview() {
  const {
    data: overview,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.getReportsOverview(),
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings(),
  });

  const byStatus = overview?.by_status || {};

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <header className="pb-5 border-b border-line">
        <div className="flex items-center gap-2 text-xs font-semibold text-accent font-mono uppercase tracking-wider mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>IT & System Administration</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
          System Overview
        </h1>
        <p className="text-sm text-ink-2 mt-1">Tenant performance and compliance at a glance</p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <div className="p-8 bg-surface border border-line rounded-float text-center text-bad text-xs">
          {getApiErrorMessage(error, 'Failed to load the system overview.')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-float bg-surface border border-line space-y-1">
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>Total Employees</span>
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold font-mono text-ink">
                {overview?.total_employees ?? 0}
              </div>
            </div>
            <div className="p-4 rounded-float bg-surface border border-line space-y-1">
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>Active Probation</span>
                <Activity className="w-4 h-4 text-good" />
              </div>
              <div className="text-2xl font-bold font-mono text-good">
                {byStatus.active ?? 0}
              </div>
            </div>
            <div className="p-4 rounded-float bg-surface border border-line space-y-1">
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>Pending Interventions</span>
                <AlertTriangle className="w-4 h-4 text-warn" />
              </div>
              <div className="text-2xl font-bold font-mono text-warn">
                {overview?.pending_interventions ?? 0}
              </div>
            </div>
            <div className="p-4 rounded-float bg-surface border border-line space-y-1">
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>Avg Overall Score</span>
                <ShieldCheck className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold font-mono text-ink">
                {overview?.average_overall_score != null
                  ? Number(overview.average_overall_score).toFixed(2)
                  : '—'}
              </div>
            </div>
          </div>

          <section className="bg-surface border border-line rounded-float p-5 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-ink">Employees by Status</h2>
            <div className="flex flex-wrap gap-2">
              {['active', 'regularized', 'terminated'].map((status) => (
                <Badge key={status} variant="neutral">
                  {status}: {byStatus[status] ?? 0}
                </Badge>
              ))}
            </div>
          </section>

          {settings && (
            <section className="bg-surface border border-line rounded-float p-5 shadow-sm space-y-3">
              <h2 className="text-base font-semibold text-ink">System Settings</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(settings.deadline_thresholds || {}).map(([key, value]) => (
                  <Badge key={key} variant="accent">
                    {key.replace('_', ' ')}: {value}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(settings.kpi_templates || {}).map((industry) => (
                  <Badge key={industry} variant="neutral">
                    {industry}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
