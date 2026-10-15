import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, kpiApi, customKpiApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Skeleton, Modal, Page, EmptyState, Label, GlideSelect, SectionHead, StatBand, textareaClass } from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDate } from '../../utils/datetime';
import { TARGET, PROBATION_DAYS, COMPETENCIES, COMPETENCY_DESCRIPTIONS } from '../../config/domain';
import { Award, AlertTriangle, CheckCircle2, Info, Users } from '../../components/icons';

const SCALE = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

export default function RateEmployee() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const preselectedEmpId = searchParams.get('employee');

  // Fetch all active probationers for the selector
  const { data: employees = [], isLoading: isEmpListLoading, refetch } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const activeProbationers = useMemo(() => {
    return employees.filter((e) => e.status === 'active');
  }, [employees]);

  // Employer-configured per-competency targets (floor: TARGET). Pass/fail and
  // the "Target" marker evaluate against these, never a hardcoded 4.0.
  const { data: rubrics = [] } = useQuery({
    queryKey: ['kpi-rubrics'],
    queryFn: () => kpiApi.list(),
  });
  const targetByKey = useMemo(() => {
    const map = {};
    rubrics.forEach((r) => {
      map[r.competency] = Number(r.target_score);
    });
    return map;
  }, [rubrics]);
  const thresholdTarget = useMemo(() => {
    const values = Object.values(targetByKey).filter((v) => Number.isFinite(v));
    return values.length ? Math.max(TARGET, ...values) : TARGET;
  }, [targetByKey]);

  // Employer-defined custom KPIs (non-statutory). Rated alongside the five but
  // never folded into the overall average.
  const { data: customKpis = [] } = useQuery({
    queryKey: ['custom-kpis'],
    queryFn: () => customKpiApi.list(),
  });

  // Selected employee ID state
  const [selectedId, setSelectedId] = useState(preselectedEmpId || '');

  // Apply the URL ?employee= pre-selection (on mount / when the param changes)
  // without locking the dropdown against the user's own selection.
  useEffect(() => {
    if (preselectedEmpId) {
      setSelectedId(preselectedEmpId);
    }
  }, [preselectedEmpId]);

  // Default to the first assigned employee once the list loads, and correct a
  // stale/invalid preselected id that isn't in the assigned list.
  useEffect(() => {
    setSelectedId((prev) =>
      activeProbationers.some((e) => e.id === prev) ? prev : activeProbationers[0]?.id || ''
    );
  }, [activeProbationers]);

  const selectedEmployee = activeProbationers.find((e) => e.id === selectedId);

  // Form ratings state (5 competencies on 1.0 to 5.0 scale)
  const [ratings, setRatings] = useState({
    task_completion: TARGET,
    quality_of_work: TARGET,
    attendance_and_punctuality: TARGET,
    communication_and_teamwork: TARGET,
    initiative_and_adaptability: TARGET,
  });

  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [submittedEvaluation, setSubmittedEvaluation] = useState(null);
  const [customRatings, setCustomRatings] = useState({});

  // Seed a default score for each custom KPI once the list loads.
  useEffect(() => {
    setCustomRatings((prev) => {
      const next = { ...prev };
      customKpis.forEach((kpi) => {
        if (next[kpi.id] === undefined) next[kpi.id] = TARGET;
      });
      return next;
    });
  }, [customKpis]);

  // Calculate live overall average
  const overallAverage = useMemo(() => {
    const sum =
      ratings.task_completion +
      ratings.quality_of_work +
      ratings.attendance_and_punctuality +
      ratings.communication_and_teamwork +
      ratings.initiative_and_adaptability;
    return sum / 5.0;
  }, [ratings]);

  const submitMutation = useMutation({
    mutationFn: (payload) => evaluationApi.submitWeeklyRating(selectedId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scorecard', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['audit-trail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      setIsConfirmModalOpen(false);
      setSubmittedEvaluation(data);
      toast.success('Weekly evaluation recorded to immutable DOLE audit trail.');
    },
    onError: (err) => {
      setIsConfirmModalOpen(false);
      const errMsg = getApiErrorMessage(err, 'Failed to submit evaluation.');
      setError(errMsg);
      toast.error(errMsg);
    },
  });

  const handleRatingChange = (key, value) => {
    setRatings((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleCustomRatingChange = (key, value) => {
    setCustomRatings((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedId) {
      setError('Please select a probationary employee to evaluate.');
      return;
    }

    if (!remarks.trim() || remarks.trim().length < 10) {
      setError('Please provide meaningful behavioral remarks (at least 10 characters).');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmSubmit = () => {
    submitMutation.mutate({
      task_completion: ratings.task_completion,
      quality_of_work: ratings.quality_of_work,
      attendance_and_punctuality: ratings.attendance_and_punctuality,
      communication_and_teamwork: ratings.communication_and_teamwork,
      initiative_and_adaptability: ratings.initiative_and_adaptability,
      remarks: remarks.trim(),
      custom_kpi_ratings: customKpis.map((kpi) => ({
        custom_kpi_id: kpi.id,
        score: customRatings[kpi.id] ?? TARGET,
      })),
    });
  };

  const daysElapsed = selectedEmployee ? getDaysElapsed(selectedEmployee.start_date) : 0;

  if (submittedEvaluation) {
    return (
      <Page title="Rate Probationary Employee">
        <section aria-label="Confirmation" className="max-w-xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-good/10 text-good border border-good/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-22 font-semibold tracking-tight text-ink mt-4">
            Evaluation Successfully Recorded
          </h2>
          <p className="text-14 text-ink-2 mt-2 leading-relaxed">
            The weekly evaluation for <b className="text-ink">{selectedEmployee?.user?.full_name}</b> has
            been recorded in the immutable audit trail.
          </p>

          <dl className="mt-5 border-t border-line font-num text-14 text-left">
            <div className="flex justify-between border-b border-line py-2.5">
              <dt className="text-ink-3">Overall average</dt>
              <dd className="font-semibold text-ink">
                {submittedEvaluation.overall_score?.toFixed(1) || overallAverage.toFixed(1)} / 5.0
              </dd>
            </div>
            <div className="flex justify-between border-b border-line py-2.5">
              <dt className="text-ink-3">Evaluation date</dt>
              <dd className="text-ink">
                {submittedEvaluation.evaluation_date || formatDate(new Date())}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-ink-3">Article 296 evidentiary log</dt>
              <dd className="text-good font-semibold">Immutable record created</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3 mt-6 justify-center">
            <Button
              variant="secondary"
              onClick={() => {
                setSubmittedEvaluation(null);
                setRemarks('');
              }}
            >
              Rate Another Employee
            </Button>
            <Button variant="primary" onClick={() => navigate(`/employees/${selectedId}`)}>
              View Employee Scorecard
            </Button>
          </div>
        </section>
      </Page>
    );
  }

  return (
    <Page
      title="Rate Probationary Employee"
    >
      {error && (
        <div
          role="alert"
          className="p-3 rounded-ctl bg-bad/8 border border-line text-bad text-12 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty: no assigned reports — a single clean empty state (no dead selector) */}
      {!isEmpListLoading && activeProbationers.length === 0 ? (
        <div role="status" aria-live="polite">
          <EmptyState
            icon={Users}
            title="No assigned probationary staff"
            action={
              <Button variant="secondary" onClick={refetch}>
                Refresh
              </Button>
            }
          >
            No active probationary employees are assigned to your workspace yet. An
            employer must assign direct reports to you before you can record ratings.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Employee selector */}
          <section aria-label="Employee">
            <SectionHead title="Select employee" subtitle="Assigned probationary staff only" />
            <div className="max-w-md">
              {isEmpListLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <GlideSelect
                  id="empSelect"
                  className="glide-select--field"
                  ariaLabel="Select Probationary Employee"
                  value={selectedId}
                  onChange={(value) => setSelectedId(value)}
                  options={activeProbationers.map((emp) => ({
                    value: emp.id,
                    label: `${emp.user?.full_name} · ${emp.job_title} (${emp.department})`,
                  }))}
                />
              )}
            </div>
          </section>

          <StatBand
            cells={[
              {
                label: 'Probation day',
                value: selectedEmployee ? `Day ${daysElapsed} of ${PROBATION_DAYS}` : '—',
                caption: selectedEmployee
                  ? `${Math.max(0, PROBATION_DAYS - daysElapsed)} days remaining`
                  : 'Select an employee',
                tone: daysElapsed > PROBATION_DAYS ? 'bad' : undefined,
              },
              {
                label: 'Regularizing target',
                value: `${thresholdTarget.toFixed(1)} / 5.0`,
                caption: 'Article 296 floor',
              },
            ]}
          />

          {!isEmpListLoading && (
            <form onSubmit={handleOpenConfirm} className="space-y-8">
              {/* Competencies — one SectionHead + scale per competency */}
              <section aria-label="Competencies">
                <SectionHead title="Competencies" subtitle="Rate each on the 1.0–5.0 scale" />
                <p className="text-12 text-ink-3 mb-5">
                  Scale: 1.0 Unsatisfactory · 4.0 Regularizing Standard · 5.0 Exceptional
                </p>

                <div className="space-y-5">
                  {COMPETENCIES.map((comp) => {
                    const currentScore = ratings[comp.key];
                    const target = targetByKey[comp.key] ?? TARGET;
                    const isMeets = currentScore >= target;

                    return (
                      <div key={comp.key}>
                        <SectionHead
                          title={comp.label}
                          subtitle={COMPETENCY_DESCRIPTIONS[comp.key]}
                          note={
                            <span className={`font-num font-semibold ${isMeets ? 'text-good' : 'text-warn'}`}>
                              {currentScore.toFixed(1)} · target {target.toFixed(1)}
                            </span>
                          }
                        />
                        <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
                          {SCALE.map((score) => {
                            const isSelected = currentScore === score;
                            const isTarget = score === target;
                            return (
                              <button
                                key={score}
                                type="button"
                                onClick={() => handleRatingChange(comp.key, score)}
                                aria-pressed={isSelected}
                                aria-label={`Score ${score.toFixed(1)}${isTarget ? ' (regularizing target)' : ''}`}
                                className={`h-9 rounded-ctl border font-num text-12 font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-accent text-accent-foreground border-accent'
                                    : isTarget
                                    ? 'border-accent/50 text-ink hover:border-accent'
                                    : 'bg-hover/80 text-ink border-line hover:border-ink-3'
                                }`}
                              >
                                {score.toFixed(1)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Employer-defined custom KPIs — rated, but never part of the 4.0 average */}
              {customKpis.length > 0 && (
                <section aria-label="Custom KPIs">
                  <SectionHead
                    title="Custom KPIs"
                    subtitle="Employer-defined criteria · not part of the 4.0 regularizing standard"
                  />
                  <div className="space-y-5">
                    {customKpis.map((kpi) => {
                      const currentScore = customRatings[kpi.id] ?? TARGET;
                      return (
                        <div key={kpi.id}>
                          <SectionHead
                            title={kpi.name}
                            note={
                              <span className="font-num font-semibold text-ink-3">
                                {currentScore.toFixed(1)}
                              </span>
                            }
                          />
                          <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
                            {SCALE.map((score) => {
                              const isSelected = currentScore === score;
                              return (
                                <button
                                  key={score}
                                  type="button"
                                  onClick={() => handleCustomRatingChange(kpi.id, score)}
                                  aria-pressed={isSelected}
                                  aria-label={`Score ${score.toFixed(1)} for ${kpi.name}`}
                                  className={`h-9 rounded-ctl border font-num text-12 font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-accent text-accent-foreground border-accent'
                                      : 'bg-hover/80 text-ink border-line hover:border-ink-3'
                                  }`}
                                >
                                  {score.toFixed(1)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Overall summary + evidentiary remarks */}
              <section aria-label="Summary">
                <SectionHead
                  title="Overall evaluation summary"
                  subtitle="Calculated across the 5 core competencies"
                  note={
                    <Badge variant={overallAverage >= thresholdTarget ? 'ok' : 'warn'}>
                      {overallAverage >= thresholdTarget ? 'On track' : 'Below target'}
                    </Badge>
                  }
                />

                <p className="flex items-baseline gap-2 mb-4">
                  <span
                    className={`font-num text-22 font-semibold ${
                      overallAverage >= thresholdTarget ? 'text-good' : 'text-warn'
                    }`}
                  >
                    {overallAverage.toFixed(1)}
                  </span>
                  <span className="text-12 text-ink-3 font-num">
                    / 5.0 · target {thresholdTarget.toFixed(1)}
                  </span>
                </p>

                <div className="flex justify-between items-center mb-1.5">
                  <Label htmlFor="remarks">Evidentiary Behavioral Remarks *</Label>
                  <span className="text-12 text-ink-3 font-num">
                    {remarks.length} / 500 characters
                  </span>
                </div>
                <textarea
                  id="remarks"
                  rows={4}
                  required
                  maxLength={500}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Detail specific behavioral evidence, projects completed, coaching provided, and concrete milestones achieved this week…"
                  className={textareaClass}
                />
                <p className="text-12 text-ink-3 mt-1.5 leading-relaxed flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span>
                    <span className="text-ink-2 font-medium">Write what you actually saw</span>: the
                    project, the date, the coaching you gave. Specifics keep the rating fair to the
                    employee and defensible under Article 296 for any regularizing or non-regularizing
                    action before DOLE.
                  </span>
                </p>

                <div className="flex justify-end pt-3">
                  <Button type="submit" variant="primary" size="lg" leftIcon={Award}>
                    Submit Evaluation
                  </Button>
                </div>
              </section>
            </form>
          )}
        </>
      )}

      {/* Immutable Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        labelledBy="confirm-eval-title"
        maxWidth="max-w-lg"
        panelClassName="sm:p-7"
      >
        <div className="pb-3 border-b border-line">
          <h3 id="confirm-eval-title" className="text-16 font-semibold text-ink">
            Confirm Immutable Evaluation Submission
          </h3>
          <p className="text-12 text-ink-3">Article 296 Evidentiary Logging</p>
        </div>

        <p className="text-14 text-ink-2 leading-relaxed">
          You are submitting a weekly performance rating of{' '}
          <b className="font-num text-ink">{overallAverage.toFixed(1)} / 5.0</b> for{' '}
          <b className="text-ink">{selectedEmployee?.user?.full_name}</b>.
        </p>

        <div className="p-4 rounded-ctl bg-hover border border-line text-14 text-ink-3 space-y-1">
          <span className="font-semibold text-ink block">Legal Notice on Audit Trail:</span>
          <p className="leading-relaxed">
            Under Philippine labor jurisprudence, evaluations once entered into the platform are
            permanently recorded in the append-only audit trail. They cannot be retracted, edited, or
            deleted.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="ghost" onClick={() => setIsConfirmModalOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            isLoading={submitMutation.isPending}
            onClick={handleConfirmSubmit}
          >
            Confirm & Record
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
