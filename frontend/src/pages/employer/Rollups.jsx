import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionApi, employeeApi, getApiErrorMessage } from '../../api';
import { Button, Badge, Skeleton } from '../../components/ui';
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
} from 'lucide-react';

export default function Rollups() {
  const queryClient = useQueryClient();

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
      setIsGenerateModalOpen(false);
      setActionMessage({
        type: 'success',
        text: 'Monthly rollup and AI rationales generated successfully.',
      });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 3500);
    },
    onError: (err) => {
      setActionMessage({
        type: 'error',
        text: getApiErrorMessage(err, 'Failed to generate monthly rollup.'),
      });
    },
  });

  const handleOpenGenerate = () => {
    if (activeProbationers.length > 0 && !selectedEmpId) {
      setSelectedEmpId(activeProbationers[0].id);
    }
    setIsGenerateModalOpen(true);
  };

  const handleGenerateSubmit = (e) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    generateMutation.mutate();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Monthly Rollups & AI Sign-Off
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Gemini Performance Summaries & Random Forest Course Recommendations
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={Sparkles}
          onClick={handleOpenGenerate}
        >
          Generate Rollup
        </Button>
      </header>

      {/* Action Notification */}
      {actionMessage.text && (
        <div
          className={`p-3.5 rounded-ctl text-xs flex items-center gap-2 border border-line animate-in fade-in duration-150 ${
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
            <h2 className="text-base font-semibold text-ink">Pending Employer Approvals</h2>
            <Badge variant="warn">{pendingPlans.length} Pending</Badge>
          </div>
          <span className="text-xs text-ink-3">Article 296 Evidentiary Support</span>
        </div>

        {isPlansLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : isError ? (
          <div className="p-8 bg-surface border border-line rounded-float text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-sm font-semibold text-ink">Failed to load pending plans</h3>
            <p className="text-xs text-ink-3">
              {getApiErrorMessage(error, 'An error occurred while fetching pending plans.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : pendingPlans.length === 0 ? (
          <div className="p-12 bg-surface border border-line rounded-float text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-ink">No pending intervention approvals</h3>
            <p className="text-xs text-ink-3 max-w-md mx-auto">
              All training recommendations have been processed. Click "Generate Rollup" to run the 30-day Gemini evaluation rollup on an active probationer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-surface border border-line rounded-float p-5 sm:p-6 shadow-sm space-y-4 hover:border-ink-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base text-ink">
                        {plan.intervention_title}
                      </span>
                      <Badge variant="accent">{plan.competency?.replace('_', ' ')}</Badge>
                      <Badge variant="neutral">{plan.intervention_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-3 font-mono">
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
                      Approve Course
                    </Button>
                  </div>
                </div>

                {/* AI Rationale by Gemini */}
                {plan.rationale && (
                  <div className="p-3.5 rounded-ctl bg-hover/70 border border-line text-xs text-ink-2 space-y-1">
                    <span className="font-semibold text-accent flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gemini Performance Rationale</span>
                    </span>
                    <p className="leading-relaxed">{plan.rationale}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Generate Rollup Modal */}
      {isGenerateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Generate monthly rollup"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsGenerateModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-line rounded-float shadow-pop p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="text-base font-semibold text-ink">Generate 30-Day Rollup</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="r_emp">
                  Probationary Employee *
                </label>
                <select
                  id="r_emp"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full h-10 px-3 rounded-ctl border border-line bg-surface text-ink text-sm focus:outline-none focus:border-accent transition-colors"
                >
                  {activeProbationers.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.full_name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="r_month">
                  Evaluation Month (30-Day Cycle) *
                </label>
                <select
                  id="r_month"
                  value={monthNumber}
                  onChange={(e) => setMonthNumber(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-ctl border border-line bg-surface text-ink text-sm focus:outline-none focus:border-accent transition-colors font-mono"
                >
                  <option value={1}>Month 1 (Days 1 - 30)</option>
                  <option value={2}>Month 2 (Days 31 - 60)</option>
                  <option value={3}>Month 3 (Days 61 - 90)</option>
                  <option value={4}>Month 4 (Days 91 - 120)</option>
                  <option value={5}>Month 5 (Days 121 - 150 · Pre-Milestone)</option>
                </select>
              </div>

              <div className="p-3 rounded-ctl bg-hover text-xs text-ink-3 leading-relaxed space-y-1">
                <span className="font-semibold text-ink block">AI Execution Workflow:</span>
                <p>
                  1. Aggregates weekly evaluation scores.<br />
                  2. Random Forest predicts risk tier (`Meets Expectations`, `Needs Improvement`, `Critical Gap`).<br />
                  3. Gemini 2.5 Flash generates tailored executive rationale.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
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
          </div>
        </div>
      )}
    </div>
  );
}
