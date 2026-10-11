import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, EmptyState, Card, CardSkeleton, Page } from '../../components/ui';
import { CheckCircle2, AlertCircle } from '../../components/icons';

const STATUS = {
  approved: { variant: 'accent', label: 'Active Assignment' },
  completed: { variant: 'ok', label: 'Completed' },
  rejected: { variant: 'bad', label: 'Not Assigned' },
  pending_approval: { variant: 'warn', label: 'Pending Approval' },
};

export default function EmployeeTraining() {
  const queryClient = useQueryClient();
  const toast = useToast();

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

  const completeMutation = useMutation({
    mutationFn: (planId) => interventionApi.completePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-interventions'] });
      toast.success('Training marked complete.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to mark training complete.')),
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
            <h3 className="text-16 font-semibold text-ink">Failed to load your training plans</h3>
            <p className="text-12 text-ink-3 max-w-sm mx-auto">
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
                      <h3 className="text-16 font-semibold text-ink">
                        {plan.intervention_title}
                      </h3>
                      <span className="text-12 text-ink-3">
                        {plan.competency?.replace(/_/g, ' ')}
                        {plan.intervention_type ? ` · ${plan.intervention_type}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-12 text-ink-3 font-num">
                      <span>Duration: {plan.default_timeline || '—'}</span>
                      <span>·</span>
                      <span>Catalog ID: {plan.catalog_id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <Badge variant={(STATUS[plan.status] || STATUS.pending_approval).variant}>
                      {(STATUS[plan.status] || STATUS.pending_approval).label}
                    </Badge>
                    {plan.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={CheckCircle2}
                        isLoading={
                          completeMutation.isPending && completeMutation.variables === plan.id
                        }
                        onClick={() => completeMutation.mutate(plan.id)}
                      >
                        Mark complete
                      </Button>
                    )}
                  </div>
                </div>

                {plan.rationale && (
                  <div className="p-4 rounded-ctl bg-hover/70 border border-line text-12 text-ink-2 space-y-1">
                    <span className="font-semibold text-accent text-12">
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
