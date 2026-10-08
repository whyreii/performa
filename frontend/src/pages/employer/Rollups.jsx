import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionApi, employeeApi, getApiErrorMessage } from '../../api';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Skeleton, Modal, EmptyState, Card, Page, GlideSelect } from '../../components/ui';
import {
  FileCheck2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  BookOpen,
  Building,
  Calendar,
  Plus,
  X,
  ArrowRight,
} from '../../components/icons';

export default function Rollups() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [monthNumber, setMonthNumber] = useState(1);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  // Fetch pending interventions
  const {
    data: pendingPlans = [],
    isLoading: isPlansLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pending-interventions'],
    queryFn: () => interventionApi.listPending(),
  });

  // Fetch employees for generation modal
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const activeProbationers = employees.filter((e) => e.status === 'active');
  const selectedEmp = activeProbationers.find((e) => e.id === selectedEmpId);

  // Sign-off mutation
  const signOffMutation = useMutation({
    mutationFn: ({ planId, approved }) => interventionApi.signOff(planId, approved),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-interventions'] });
      queryClient.invalidateQueries({ queryKey: ['intervention-plans'] });
      setActionMessage({
        type: 'success',
        text: `Training intervention ${variables.approved ? 'approved' : 'rejected'} successfully.`,
      });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 3000);
    },
    onError: (err) => {
      setActionMessage({
        type: 'error',
        text: getApiErrorMessage(err, 'Failed to update intervention sign-off.'),
      });
    },
  });

  // Generate rollup mutation
  const generateMutation = useMutation({
    mutationFn: () => interventionApi.generateRollup(selectedEmpId, monthNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-interventions'] });
      queryClient.invalidateQueries({ queryKey: ['intervention-plans'] });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      setIsGenerateModalOpen(false);
      toast.success('Monthly rollup and AI rationales generated successfully.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to generate monthly rollup.'));
    },
  });

  // Monthly summaries (dispatch to employees for acknowledgement)
  const {
    data: summaries = [],
    isLoading: isSummariesLoading,
    isError: isSummariesError,
  } = useQuery({
    queryKey: ['summaries'],
    queryFn: () => interventionApi.listSummaries(),
  });

  const dispatchMutation = useMutation({
    mutationFn: (id) => interventionApi.dispatchSummary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      setActionMessage({ type: 'success', text: 'Summary dispatched to employee.' });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 3000);
    },
    onError: (err) => {
      setActionMessage({
        type: 'error',
        text: getApiErrorMessage(err, 'Failed to dispatch summary.'),
      });
    },
  });

  // Default the evaluation month to the employee's current 30-day cycle
  // (clamped to the 5-month operating window) instead of always month 1.
  const monthForEmployee = (empId) => {
    const emp = activeProbationers.find((e) => e.id === empId);
    if (!emp) return 1;
    return Math.min(5, Math.max(1, Math.ceil(getDaysElapsed(emp.start_date) / 30)));
  };

  const handleOpenGenerate = () => {
    const empId = selectedEmpId || activeProbationers[0]?.id || '';
    setSelectedEmpId(empId);
    setMonthNumber(monthForEmployee(empId));
    setIsGenerateModalOpen(true);
  };

  const handleGenerateSubmit = (e) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    generateMutation.mutate();
  };

  return (
    <Page
        title="Rollups"
        subtitle="Gemini summaries · Random Forest recommendations"
        actions={
          <Button variant="primary" leftIcon={Sparkles} onClick={handleOpenGenerate}>
            Generate Rollup
          </Button>
        }
    >

      {/* Action Notification */}
      {actionMessage.text && (
        <div
          role="alert"
          className={`p-3 rounded-ctl text-12 flex items-center gap-2 border border-line animate-in fade-in duration-150 ${
            actionMessage.type === 'error'
              ? 'bg-bad/8 text-bad'
              : 'bg-ok/8 text-ok'
          }`}
        >
          {actionMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Pending Interventions Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-16 font-semibold text-ink">Pending approvals</h2>
            <Badge variant="warn">{pendingPlans.length} Pending</Badge>
          </div>
          <span className="text-12 text-ink-3">Article 296 Evidentiary Support</span>
        </div>

        {isPlansLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : isError ? (
          <Card padded={false} className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-14 font-semibold text-ink">Failed to load pending plans</h3>
            <p className="text-12 text-ink-3">
              {getApiErrorMessage(error, 'An error occurred while fetching pending plans.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        ) : pendingPlans.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No pending intervention approvals">
            All training recommendations have been processed. Click "Generate Rollup" to run the 30-day Gemini evaluation rollup on an active probationer.
          </EmptyState>
        ) : (
          <Card padded={false} className="divide-y divide-line">
            {pendingPlans.map((plan) => (
              <div key={plan.id} className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-14 text-ink">
                        {plan.intervention_title}
                      </span>
                      <span className="text-12 text-ink-3">
                        {plan.competency?.replace(/_/g, ' ')}
                        {plan.intervention_type ? ` · ${plan.intervention_type}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-12 text-ink-3 font-num">
                      <span>Timeline: {plan.default_timeline || '4 hours'}</span>
                      <span>·</span>
                      <span>Catalog ID: {plan.catalog_id}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={XCircle}
                      disabled={signOffMutation.isPending}
                      onClick={() =>
                        signOffMutation.mutate({ planId: plan.id, approved: false })
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={CheckCircle2}
                      disabled={signOffMutation.isPending}
                      onClick={() =>
                        signOffMutation.mutate({ planId: plan.id, approved: true })
                      }
                    >
                      Approve
                    </Button>
                  </div>
                </div>

                {/* AI Rationale by Gemini */}
                {plan.rationale && (
                  <div className="p-3 rounded-ctl bg-hover/70 border border-line text-12 text-ink-2 space-y-1">
                    <span className="font-semibold text-accent text-12">
                      Gemini Performance Rationale
                    </span>
                    <p className="leading-relaxed">{plan.rationale}</p>
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Monthly Summaries (dispatch for acknowledgement) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-16 font-semibold text-ink">Monthly summaries</h2>
          <span className="text-12 text-ink-3">Dispatch to employees for digital acknowledgement</span>
        </div>
        {isSummariesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isSummariesError ? (
          <Card padded={false} className="p-6 text-center text-12 text-bad">
            Unable to load monthly summaries right now. Please retry.
          </Card>
        ) : summaries.length === 0 ? (
          <Card padded={false} className="p-6 text-center text-12 text-ink-3">
            No monthly summaries generated yet. Run a rollup above.
          </Card>
        ) : (
          <Card padded={false} className="divide-y divide-line">
            {summaries.map((summary) => {
              const emp = employees.find((e) => e.id === summary.employee_id);
              return (
                <div key={summary.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="text-12">
                    <span className="font-semibold text-ink">
                      {emp?.user?.full_name || 'Unknown employee'}
                    </span>
                    {emp?.department && (
                      <span className="text-ink-3 ml-2">{emp.department}</span>
                    )}
                    <span className="text-ink-3 font-num ml-2">
                      Month {summary.month_number}
                    </span>
                    <span className="text-ink-3 font-num ml-2">
                      Avg {Number(summary.overall_average).toFixed(2)}
                    </span>
                    <span className="text-ink-3 ml-2 capitalize">
                      {summary.status_classification?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {summary.acknowledged_at ? (
                    <Badge variant="ok">Acknowledged</Badge>
                  ) : summary.dispatched_at ? (
                    <Badge variant="accent">Dispatched</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={dispatchMutation.isPending}
                      onClick={() => dispatchMutation.mutate(summary.id)}
                    >
                      Dispatch
                    </Button>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* Generate Rollup Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        label="Generate monthly rollup"
        maxWidth="max-w-md"
      >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-16 font-semibold text-ink">Generate 30-Day Rollup</h3>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-ink-3 hover:text-ink"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-12 font-medium text-ink-2 mb-1" htmlFor="r_emp">
                  Probationary Employee *
                </label>
                <GlideSelect
                  id="r_emp"
                  className="glide-select--field"
                  ariaLabel="Probationary Employee"
                  value={selectedEmpId}
                  onChange={(value) => {
                    setSelectedEmpId(value);
                    setMonthNumber(monthForEmployee(value));
                  }}
                  options={activeProbationers.map((emp) => ({
                    value: emp.id,
                    label: `${emp.user?.full_name} (${emp.department})`,
                  }))}
                />
              </div>

              <div>
                <label className="block text-12 font-medium text-ink-2 mb-1" htmlFor="r_month">
                  Evaluation Month (30-Day Cycle) *
                </label>
                <GlideSelect
                  id="r_month"
                  className="glide-select--field"
                  ariaLabel="Evaluation Month"
                  value={monthNumber}
                  onChange={(value) => setMonthNumber(Number(value))}
                  options={[
                    { value: 1, label: 'Month 1 (Days 1 - 30)' },
                    { value: 2, label: 'Month 2 (Days 31 - 60)' },
                    { value: 3, label: 'Month 3 (Days 61 - 90)' },
                    { value: 4, label: 'Month 4 (Days 91 - 120)' },
                    { value: 5, label: 'Month 5 (Days 121 - 150 · Pre-Milestone)' },
                  ]}
                />
              </div>

              {selectedEmp && (
                <div className="flex items-center justify-between gap-2 text-12 text-ink-3">
                  <span>
                    {selectedEmp.user?.full_name} · Day {getDaysElapsed(selectedEmp.start_date)} of 180
                  </span>
                  <Link
                    to={`/supervisor/rate?employee=${selectedEmp.id}`}
                    className="inline-flex items-center gap-1 text-accent font-semibold hover:underline shrink-0"
                  >
                    Rate first
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              <div className="p-3 rounded-ctl bg-hover text-12 text-ink-3 leading-relaxed space-y-1">
                <span className="font-semibold text-ink block">AI Execution Workflow:</span>
                <p>
                  1. Aggregates weekly evaluation scores.<br />
                  2. Random Forest predicts risk tier (`Meets Expectations`, `Needs Improvement`, `Critical Gap`).<br />
                  3. Gemini generates tailored executive rationale.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsGenerateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={generateMutation.isPending}
                  leftIcon={Sparkles}
                >
                  Execute AI Rollup
                </Button>
              </div>
            </form>
      </Modal>
    </Page>
  );
}
