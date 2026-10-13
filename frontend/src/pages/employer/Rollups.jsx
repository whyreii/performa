import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionApi, employeeApi, getApiErrorMessage } from '../../api';
import { daysElapsed as getDaysElapsed, monthNumberFor } from '../../utils/datetime';
import { PROBATION_MONTHS, PROBATION_MONTH_DAYS, COMPETENCIES } from '../../config/domain';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Skeleton, Modal, EmptyState, Page, Label, GlideSelect, ConfirmDialog, SectionHead, Th } from '../../components/ui';
import { FileCheck2, Sparkles, CheckCircle2, XCircle, AlertCircle, X, ArrowRight } from '../../components/icons';

const LABEL_BY_KEY = Object.fromEntries(COMPETENCIES.map((c) => [c.key, c.label]));
const competencyLabel = (key) => LABEL_BY_KEY[key] || key?.replace(/_/g, ' ') || '';

export default function Rollups() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [monthNumber, setMonthNumber] = useState(1);
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [confirmDispatch, setConfirmDispatch] = useState(null);

  // Monthly-summaries table sort (every data column).
  const [summarySort, setSummarySort] = useState({ key: 'employee', dir: 'asc' });
  const onSummarySort = (key) =>
    setSummarySort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

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
      toast.success(`Training intervention ${variables.approved ? 'approved' : 'rejected'}.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update intervention sign-off.')),
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
    error: summariesError,
    refetch: refetchSummaries,
  } = useQuery({
    queryKey: ['summaries'],
    queryFn: () => interventionApi.listSummaries(),
  });

  const dispatchMutation = useMutation({
    mutationFn: (id) => interventionApi.dispatchSummary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      toast.success('Summary dispatched to employee.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to dispatch summary.')),
  });

  // Summaries rows sorted by the selected column (derived columns use a rank,
  // not the chip label).
  const summaryRows = useMemo(() => {
    const RISK_RANK = { 'Meets Expectations': 0, 'Needs Improvement': 1, 'Critical Gap': 2 };
    const STATUS_RANK = { acknowledged: 0, dispatched: 1, pending: 2 };
    const nameOf = (s) =>
      (employees.find((e) => e.id === s.employee_id)?.user?.full_name || '').toLowerCase();
    const keyOf = (s) => {
      switch (summarySort.key) {
        case 'cycle':
          return Number(s.month_number) || 0;
        case 'overall':
          return Number(s.overall_average) || 0;
        case 'risk':
          return RISK_RANK[s.status_classification] ?? 9;
        case 'status':
          return STATUS_RANK[
            s.acknowledged_at ? 'acknowledged' : s.dispatched_at ? 'dispatched' : 'pending'
          ];
        default:
          return nameOf(s);
      }
    };
    const list = [...summaries];
    list.sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      const r = ka < kb ? -1 : ka > kb ? 1 : 0;
      return summarySort.dir === 'asc' ? r : -r;
    });
    return list;
  }, [summaries, employees, summarySort]);

  // Default the evaluation month to the employee's current 30-day cycle
  // (clamped to the 5-month operating window) instead of always month 1.
  const monthForEmployee = (empId) => {
    const emp = activeProbationers.find((e) => e.id === empId);
    if (!emp) return 1;
    return Math.min(PROBATION_MONTHS, monthNumberFor(getDaysElapsed(emp.start_date)));
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
      title="Rollups & AI Plans"
      subtitle="Gemini summaries · Random Forest recommendations"
      actions={
        <Button variant="primary" leftIcon={Sparkles} onClick={handleOpenGenerate}>
          Generate Rollup
        </Button>
      }
    >
      {/* Pending Interventions Queue */}
      <section aria-label="Pending approvals">
        <SectionHead
          title="Pending approvals"
          subtitle="Article 296 evidentiary support"
          note={<Badge variant="warn">{pendingPlans.length} pending</Badge>}
        />

        {isPlansLoading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-14 font-semibold text-ink">Failed to load pending plans</h3>
            <p className="text-12 text-ink-3">
              {getApiErrorMessage(error, 'An error occurred while fetching pending plans.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : pendingPlans.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No pending intervention approvals">
            All training recommendations have been processed. Click “Generate Rollup” to run the 30-day Gemini evaluation rollup on an active probationer.
          </EmptyState>
        ) : (
          <div>
            {pendingPlans.map((plan) => (
              <div key={plan.id} className="border-t border-line py-4 first:border-t-0 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-14 text-ink">
                        {plan.intervention_title}
                      </span>
                      <span className="text-12 text-ink-3">
                        {competencyLabel(plan.competency)}
                        {plan.intervention_type ? ` · ${plan.intervention_type}` : ''}
                      </span>
                    </div>
                    <div className="text-12 text-ink-3 font-num">
                      Timeline: {plan.default_timeline || '—'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={XCircle}
                      disabled={signOffMutation.isPending}
                      onClick={() => setConfirmPlan({ plan, approved: false })}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={CheckCircle2}
                      disabled={signOffMutation.isPending}
                      onClick={() => setConfirmPlan({ plan, approved: true })}
                    >
                      Approve
                    </Button>
                  </div>
                </div>

                {/* AI Rationale by Gemini */}
                {plan.rationale && (
                  <div className="border-t border-line pt-2.5 text-14 text-ink-2 space-y-1">
                    <span className="font-semibold text-ink-3 text-12">
                      Gemini Performance Rationale
                    </span>
                    <p className="leading-relaxed">{plan.rationale}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Monthly Summaries (dispatch for acknowledgement) */}
      <section aria-label="Monthly summaries">
        <SectionHead
          title="Monthly summaries"
          subtitle="Dispatch to employees for digital acknowledgement"
        />
        {isSummariesLoading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isSummariesError ? (
          <div className="py-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-14 font-semibold text-ink">Failed to load monthly summaries</h3>
            <p className="text-12 text-ink-3">
              {getApiErrorMessage(summariesError, 'Please retry.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetchSummaries()}>
              Retry
            </Button>
          </div>
        ) : summaries.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No monthly summaries yet">
            Run a rollup above to generate 30-day summaries for dispatch.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Monthly summaries dispatched for acknowledgement</caption>
              <thead>
                <tr className="border-b border-line text-12 text-ink-3">
                  <Th sortKey="employee" activeKey={summarySort.key} dir={summarySort.dir} onSort={onSummarySort} className="py-2.5 pr-4">
                    Employee
                  </Th>
                  <Th sortKey="cycle" activeKey={summarySort.key} dir={summarySort.dir} onSort={onSummarySort} className="py-2.5 pr-4">
                    Cycle
                  </Th>
                  <Th sortKey="overall" activeKey={summarySort.key} dir={summarySort.dir} onSort={onSummarySort} align="right" className="py-2.5 pr-4">
                    Overall
                  </Th>
                  <Th sortKey="risk" activeKey={summarySort.key} dir={summarySort.dir} onSort={onSummarySort} className="py-2.5 pr-4">
                    Risk tier
                  </Th>
                  <Th sortKey="status" activeKey={summarySort.key} dir={summarySort.dir} onSort={onSummarySort} align="right" className="py-2.5">
                    Status
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summaryRows.map((summary) => {
                  const emp = employees.find((e) => e.id === summary.employee_id);
                  const cls = summary.status_classification?.replace(/_/g, ' ');
                  const variant = /Meets/i.test(cls || '')
                    ? 'ok'
                    : /Critical/i.test(cls || '')
                    ? 'bad'
                    : 'warn';
                  return (
                    <tr key={summary.id}>
                      <td className="py-3 pr-4">
                        <div className="text-14 text-ink truncate">
                          {emp?.user?.full_name || '—'}
                        </div>
                        {emp?.department ? (
                          <div className="text-12 text-ink-3 truncate">{emp.department}</div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-14 font-num text-ink-2">
                        Month {summary.month_number}
                      </td>
                      <td className="py-3 pr-4 text-right text-14 font-semibold font-num text-ink">
                        {Number(summary.overall_average).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4">
                        {cls ? <Badge variant={variant}>{cls}</Badge> : null}
                      </td>
                      <td className="py-3 text-right">
                        {summary.acknowledged_at ? (
                          <Badge variant="ok">Acknowledged</Badge>
                        ) : summary.dispatched_at ? (
                          <Badge variant="accent">Dispatched</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={dispatchMutation.isPending}
                            onClick={() => setConfirmDispatch(summary)}
                          >
                            Dispatch
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleGenerateSubmit} className="space-y-4">
          <div>
            <Label htmlFor="r_emp">Probationary Employee *</Label>
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
            <Label htmlFor="r_month">Evaluation Month (30-Day Cycle) *</Label>
            <GlideSelect
              id="r_month"
              className="glide-select--field"
              ariaLabel="Evaluation Month"
              value={monthNumber}
              onChange={(value) => setMonthNumber(Number(value))}
              options={Array.from({ length: PROBATION_MONTHS }, (_, i) => {
                const n = i + 1;
                const start = (n - 1) * PROBATION_MONTH_DAYS;
                const end = n * PROBATION_MONTH_DAYS - 1;
                return { value: n, label: `Month ${n} · Days ${start}-${end}` };
              })}
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

          <div className="p-3 rounded-ctl bg-hover text-14 text-ink-3 leading-relaxed space-y-1">
            <span className="font-semibold text-ink block">AI execution workflow:</span>
            <p>
              1. Aggregates weekly evaluation scores.<br />
              2. Random Forest predicts the risk tier (Meets Expectations, Needs Improvement, Critical Gap).<br />
              3. Gemini generates the tailored executive rationale.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <Button type="button" variant="ghost" onClick={() => setIsGenerateModalOpen(false)}>
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

      <ConfirmDialog
        isOpen={!!confirmPlan}
        onClose={() => setConfirmPlan(null)}
        onConfirm={() => {
          if (confirmPlan) {
            signOffMutation.mutate({
              planId: confirmPlan.plan.id,
              approved: confirmPlan.approved,
            });
          }
          setConfirmPlan(null);
        }}
        title={confirmPlan?.approved ? 'Approve intervention?' : 'Reject intervention?'}
        confirmLabel={confirmPlan?.approved ? 'Approve' : 'Reject'}
        variant={confirmPlan?.approved ? 'primary' : 'danger'}
        isLoading={signOffMutation.isPending}
      >
        {confirmPlan && (
          <>
            <p>
              {confirmPlan.approved ? 'You are approving' : 'You are rejecting'}{' '}
              <b className="text-ink">{confirmPlan.plan.intervention_title}</b>
              {confirmPlan.plan.competency
                ? ` for ${competencyLabel(confirmPlan.plan.competency)}`
                : ''}
              .
            </p>
            <p className="text-12 text-ink-3">
              This sign-off is recorded in the intervention audit trail.
            </p>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={!!confirmDispatch}
        onClose={() => setConfirmDispatch(null)}
        onConfirm={() => {
          if (confirmDispatch) dispatchMutation.mutate(confirmDispatch.id);
          setConfirmDispatch(null);
        }}
        title="Dispatch monthly summary?"
        confirmLabel="Dispatch"
        isLoading={dispatchMutation.isPending}
      >
        {confirmDispatch && (
          <p>
            This sends the Month {confirmDispatch.month_number} summary to{' '}
            <b className="text-ink">
              {employees.find((e) => e.id === confirmDispatch.employee_id)?.user?.full_name ||
                'the employee'}
            </b>{' '}
            for digital acknowledgement.
          </p>
        )}
      </ConfirmDialog>
    </Page>
  );
}
