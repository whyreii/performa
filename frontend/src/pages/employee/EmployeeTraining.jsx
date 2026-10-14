import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/datetime';
import { COMPETENCIES } from '../../config/domain';
import { Button, Badge, EmptyState, CardSkeleton, Page } from '../../components/ui';
import { CheckCircle2, AlertCircle } from '../../components/icons';

const LABEL_BY_KEY = Object.fromEntries(COMPETENCIES.map((c) => [c.key, c.label]));
const competencyLabel = (key) => LABEL_BY_KEY[key] || key?.replace(/_/g, ' ') || '';

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
    >
      {isLoading ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <div className="py-10 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-bad mx-auto" />
          <h3 className="text-16 font-semibold text-ink">Failed to load your training plans</h3>
          <p className="text-12 text-ink-3 max-w-sm mx-auto">
            {getApiErrorMessage(error, 'An error occurred while fetching your interventions.')}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : plans.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No required training interventions">
          Your weekly competency evaluations currently meet or exceed required performance standards.
        </EmptyState>
      ) : (
        <div>
          {plans.map((plan) => {
            const status = STATUS[plan.status] || STATUS.pending_approval;
            return (
              <div key={plan.id} className="border-t border-line py-4 first:border-t-0 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-16 font-semibold text-ink">
                        {plan.intervention_title}
                      </span>
                      <span className="text-12 text-ink-3">
                        {competencyLabel(plan.competency)}
                        {plan.intervention_type ? ` · ${plan.intervention_type}` : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-12 text-ink-3 font-num mt-1">
                      <span>Duration: {plan.default_timeline || '—'}</span>
                      {plan.status === 'completed' && plan.completed_at ? (
                        <span>· Completed {formatDate(plan.completed_at)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={status.variant}>{status.label}</Badge>
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
                  <div className="border-t border-line pt-2.5 text-14 text-ink-2 space-y-1">
                    <span className="font-semibold text-ink-3 text-12">Coaching guidance</span>
                    <p className="leading-relaxed">{plan.rationale}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
