import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, kpiApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, StatusDot, Skeleton, Modal, Card, Page, EmptyState, GlideSelect, textareaClass } from '../../components/ui';
import { daysElapsed as getDaysElapsed, formatDate } from '../../utils/datetime';
import { TARGET, PROBATION_DAYS } from '../../config/domain';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Users,
  ArrowRight,
  Info,
} from '../../components/icons';

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
    });
  };

  const competencies = [
    {
      key: 'task_completion',
      label: 'Task Completion & Work Output',
      desc: 'Deliverables completed on schedule, adherence to task assignments and sprint deadlines.',
    },
    {
      key: 'quality_of_work',
      label: 'Quality of Work & Accuracy',
      desc: 'Standard of craftsmanship, error rates, attention to detail, and compliance with quality SOPs.',
    },
    {
      key: 'attendance_and_punctuality',
      label: 'Attendance & Punctuality',
      desc: 'On-time shift arrival, dependability during scheduled hours, and minimal unscheduled absences.',
    },
    {
      key: 'communication_and_teamwork',
      label: 'Communication & Teamwork',
      desc: 'Active cross-functional collaboration, constructive team spirit, and prompt status reporting.',
    },
    {
      key: 'initiative_and_adaptability',
      label: 'Initiative & Adaptability',
      desc: 'Self-driven problem solving, openness to supervisory coaching, and agility when requirements shift.',
    },
  ];

  if (submittedEvaluation) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-full bg-ok/10 text-ok border border-ok/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-22 font-bold tracking-tight text-ink">
            Evaluation Successfully Recorded
          </h1>
          <p className="text-14 text-ink-2 max-w-md mx-auto">
            The weekly evaluation for <b>{selectedEmployee?.user?.full_name}</b> has been recorded in the immutable audit trail.
          </p>
        </div>

        <Card as="div" padded={false} className="p-5 text-left space-y-3 font-num text-12">
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-3">Overall Average</span>
            <span className="font-bold text-ink text-14">
              {submittedEvaluation.overall_score?.toFixed(1) || overallAverage.toFixed(1)} / 5.0
            </span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-3">Evaluation Date</span>
            <span className="text-ink">
              {submittedEvaluation.evaluation_date || formatDate(new Date())}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Article 296 Evidentiary Log</span>
            <span className="text-ok font-semibold">Immutable Record Created</span>
          </div>
        </Card>

        <div className="flex justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              setSubmittedEvaluation(null);
              setRemarks('');
            }}
          >
            Rate Another Employee
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/employees/${selectedId}`)}
          >
            View Employee Scorecard
          </Button>
        </div>
      </div>
    );
  }

  const daysElapsed = selectedEmployee ? getDaysElapsed(selectedEmployee.start_date) : 0;

  return (
    <Page
        title="Rate Probationary Employee"
        subtitle={`Article 296 Evidentiary Due Process Matrix · Target ${thresholdTarget.toFixed(1)} Standard`}
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
        <Card>
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
        </Card>
      ) : (
        <>
          {/* Employee Selector Bar */}
          <Card padded={false} className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <label className="block text-12 font-medium text-ink-2 mb-1.5" htmlFor="empSelect">
                  Select Probationary Employee
                </label>
                {isEmpListLoading ? (
                  <Skeleton className="h-10 w-full" />
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

              {selectedEmployee && (
                <div className="flex items-center gap-6 text-12">
                  <span className="text-ink-3">
                    Probation timeline{' '}
                    <span className="font-num font-semibold text-ink">
                      Day {daysElapsed} of {PROBATION_DAYS}
                    </span>
                  </span>
                  <span className="text-ink-3">
                    Target{' '}
                    <span className="font-num font-semibold text-accent">
                      {thresholdTarget.toFixed(1)} / 5.0
                    </span>
                  </span>
                </div>
              )}
            </div>
          </Card>

          {!isEmpListLoading && (
            <form onSubmit={handleOpenConfirm} className="space-y-6">
        {/* Competency Rating Cards */}
        <div className="space-y-4">
          {competencies.map((comp, idx) => {
            const currentScore = ratings[comp.key];
            const target = targetByKey[comp.key] ?? TARGET;
            const isMeets = currentScore >= target;

            return (
              <Card
                key={comp.key}
                padded={false}
                className="p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-12 font-num font-semibold text-accent">
                      Competency {idx + 1} of 5
                    </span>
                    <h3 className="text-16 font-semibold text-ink">{comp.label}</h3>
                    <p className="text-12 text-ink-2 leading-relaxed">{comp.desc}</p>
                  </div>

                  <div className="flex items-baseline gap-2 self-start sm:self-center">
                    <span
                      className={`font-num text-22 font-bold ${
                        isMeets ? 'text-good' : 'text-warn'
                      }`}
                    >
                      {currentScore.toFixed(1)}
                    </span>
                    <span className="text-12 text-ink-3">target {target.toFixed(1)}</span>
                  </div>
                </div>

                {/* Score Selector Scale (1.0 to 5.0) */}
                <div className="pt-2">
                  <div className="grid grid-cols-9 gap-1 sm:gap-1.5 pt-3">
                    {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((score) => {
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
                  <div className="flex justify-between text-12 text-ink-3 mt-1.5 font-num">
                    <span>1.0 Unsatisfactory</span>
                    <span>{target.toFixed(1)} Regularizing Standard</span>
                    <span>5.0 Exceptional</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Behavioral Remarks & Summary Card */}
        <Card className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div>
              <h3 className="text-16 font-semibold text-ink">Overall Evaluation Summary</h3>
              <p className="text-12 text-ink-3 mt-0.5">
                Calculated across the 5 statutory competencies
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-12 text-ink-3 font-num block">Overall Score</span>
                <span className="text-22 font-bold font-num text-ink">
                  {overallAverage.toFixed(1)} <span className="text-12 text-ink-3">/ 5.0</span>
                </span>
              </div>
              <Badge variant={overallAverage >= thresholdTarget ? 'ok' : 'warn'}>
                {overallAverage >= thresholdTarget
                  ? 'On Track for Regularization'
                  : 'Below Regularization Target'}
              </Badge>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-12 font-semibold text-ink" htmlFor="remarks">
                Evidentiary Behavioral Remarks *
              </label>
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
          </div>

          <div className="flex justify-end pt-3">
            <Button type="submit" variant="primary" size="lg" leftIcon={Award}>
              Submit Evaluation
            </Button>
          </div>
        </Card>
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

            <p className="text-12 text-ink-2 leading-relaxed">
              You are submitting a weekly performance rating of{' '}
              <b className="font-num text-ink">{overallAverage.toFixed(1)} / 5.0</b> for{' '}
              <b className="text-ink">{selectedEmployee?.user?.full_name}</b>.
            </p>

            <div className="p-4 rounded-ctl bg-hover border border-line text-12 text-ink-3 space-y-1">
              <span className="font-semibold text-ink block">Legal Notice on Audit Trail:</span>
              <p className="leading-relaxed">
                Under Philippine labor jurisprudence, evaluations once entered into the platform are permanently recorded in the append-only audit trail. They cannot be retracted, edited, or deleted.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-line">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsConfirmModalOpen(false)}
              >
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
