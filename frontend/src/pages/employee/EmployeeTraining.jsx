import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { interventionApi, getApiErrorMessage } from '../../api';
import { Button, Badge, Skeleton } from '../../components/ui';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function EmployeeTraining() {
  // Fetch the employee's own assigned intervention plans
  const {
    data: plans = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['my-interventions'],
    queryFn: () => interventionApi.listMine(),
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <header className="pb-5 border-b border-line">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
          Assigned Training Interventions
        </h1>
        <p className="text-sm text-ink-2 mt-1">
          Targeted Learning Modules to Close Competency Gaps Before Day 150 Appraisal
        </p>
      </header>

      {/* Recommended Modules List */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 bg-surface border border-line rounded-float text-center space-y-3 shadow-sm">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-base font-semibold text-ink">Failed to load your training plans</h3>
            <p className="text-xs text-ink-3 max-w-sm mx-auto">
              {getApiErrorMessage(error, 'An error occurred while fetching your interventions.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : plans.length === 0 ? (
          <div className="p-12 bg-surface border border-line rounded-float text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-ok/10 text-ok flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-ink">No required training interventions</h3>
            <p className="text-xs text-ink-3 max-w-sm mx-auto">
              Your weekly competency evaluations currently meet or exceed required performance standards.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-3 hover:border-ink-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">
                        {plan.intervention_title}
                      </h3>
                      <Badge variant="accent">{plan.competency?.replace(/_/g, ' ')}</Badge>
                      <Badge variant="neutral">{plan.intervention_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-3 font-mono">
                      <span>Duration: {plan.default_timeline || '4 hours'}</span>
                      <span>·</span>
                      <span>Catalog ID: {plan.catalog_id}</span>
                    </div>
                  </div>

                  <Badge variant={plan.status === 'approved' ? 'ok' : plan.status === 'rejected' ? 'bad' : 'warn'}>
                    {plan.status === 'approved'
                      ? 'Active Assignment'
                      : plan.status === 'rejected'
                      ? 'Not Assigned'
                      : 'Pending Approval'}
                  </Badge>
                </div>

                {plan.rationale && (
                  <div className="p-3.5 rounded-ctl bg-hover/70 border border-line text-xs text-ink-2 space-y-1">
                    <span className="font-semibold text-accent flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Coaching Guidance</span>
                    </span>
                    <p className="leading-relaxed">{plan.rationale}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
