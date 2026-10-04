import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { interventionApi, getApiErrorMessage } from '../../api';
import { Button, Badge, EmptyState, Card, CardSkeleton, Page } from '../../components/ui';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
    <Page
        title="Assigned Training Interventions"
        subtitle="Targeted Learning Modules to Close Competency Gaps Before Day 150 Appraisal"
    >

      {/* Recommended Modules List */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : isError ? (
          <Card padded={false} className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-base font-semibold text-ink">Failed to load your training plans</h3>
            <p className="text-xs text-ink-3 max-w-sm mx-auto">
              {getApiErrorMessage(error, 'An error occurred while fetching your interventions.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        ) : plans.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No required training interventions">
            Your weekly competency evaluations currently meet or exceed required performance standards.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="space-y-3 hover:border-ink-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-base font-semibold text-ink">
                        {plan.intervention_title}
                      </h3>
                      <span className="text-12 text-ink-3">
                        {plan.competency?.replace(/_/g, ' ')}
                        {plan.intervention_type ? ` · ${plan.intervention_type}` : ''}
                      </span>
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
                  <div className="p-4 rounded-ctl bg-hover/70 border border-line text-xs text-ink-2 space-y-1">
                    <span className="font-semibold text-accent text-12 font-mono">
                      Coaching Guidance
                    </span>
                    <p className="leading-relaxed">{plan.rationale}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
