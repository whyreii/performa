import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { Button, Badge, ScoreMeter, StatusDot, Skeleton } from '../../components/ui';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  User,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function RateEmployee() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const preselectedEmpId = searchParams.get('employee');

  // Fetch all active probationers for the selector
  const { data: employees = [], isLoading: isEmpListLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const activeProbationers = useMemo(() => {
    return employees.filter((e) => e.status === 'active');
  }, [employees]);

  // Selected employee ID state
  const [selectedId, setSelectedId] = useState(preselectedEmpId || '');

  useEffect(() => {
    if (preselectedEmpId) {
      setSelectedId(preselectedEmpId);
    } else if (activeProbationers.length > 0 && !selectedId) {
      setSelectedId(activeProbationers[0].id);
    }
  }, [preselectedEmpId, activeProbationers, selectedId]);

  const selectedEmployee = activeProbationers.find((e) => e.id === selectedId);

  // Form ratings state (5 competencies on 1.0 to 5.0 scale)
  const [ratings, setRatings] = useState({
    task_completion: 4.0,
    quality_of_work: 4.0,
    attendance_and_punctuality: 4.5,
    communication_and_teamwork: 4.0,
    initiative_and_adaptability: 3.5,
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
    },
    onError: (err) => {
      setIsConfirmModalOpen(false);
      setError(getApiErrorMessage(err, 'Failed to submit evaluation.'));
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

  const getDaysElapsed = (startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
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
        <div className="w-16 h-16 rounded-full bg-ok/10 text-ok border border-ok/20 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Evaluation Successfully Recorded
          </h1>
          <p className="text-sm text-ink-2 max-w-md mx-auto">
            The weekly evaluation for <b>{selectedEmployee?.user?.full_name}</b> has been cryptographically logged into the immutable audit trail.
          </p>
        </div>

        <div className="p-5 rounded-ctl bg-surface border border-line text-left space-y-3 font-mono text-xs">
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-3">Overall Average</span>
            <span className="font-bold text-ink text-sm">
              {submittedEvaluation.overall_score?.toFixed(1) || overallAverage.toFixed(1)} / 5.0
            </span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-3">Evaluation Date</span>
            <span className="text-ink">
              {submittedEvaluation.evaluation_date || new Date().toISOString().split('T')[0]}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Article 296 Evidentiary Log</span>
            <span className="text-ok font-semibold">Immutable Record Created</span>
          </div>
        </div>

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
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Rate Probationary Employee
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Article 296 Evidentiary Due Process Matrix · Target 4.0 Standard
          </p>
        </div>
      </header>

      {error && (
        <div className="p-3.5 rounded-ctl bg-bad/10 border border-bad/20 text-bad text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Employee Selector Bar */}
      <section className="bg-surface border border-line rounded-float p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="empSelect">
              Select Probationary Employee
            </label>
            {isEmpListLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="empSelect"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full h-10 px-3 rounded-ctl border border-line bg-surface text-ink text-sm focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                {activeProbationers.length === 0 ? (
                  <option value="">No active probationary employees found</option>
                ) : (
                  activeProbationers.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.full_name} — {emp.job_title} ({emp.department})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {selectedEmployee && (
            <div className="flex items-center gap-3 p-3 rounded-ctl bg-hover border border-line text-xs">
              <div>
                <span className="text-ink-3 block">Probation Timeline</span>
                <span className="font-mono font-semibold text-ink">
                  Day {daysElapsed} of 180
                </span>
              </div>
              <div className="border-l border-line pl-3">
                <span className="text-ink-3 block">Threshold Target</span>
                <span className="font-mono font-semibold text-accent">4.0 / 5.0</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Rating Form */}
      <form onSubmit={handleOpenConfirm} className="space-y-6">
        {/* Competency Rating Cards */}
        <div className="space-y-4">
          {competencies.map((comp, idx) => {
            const currentScore = ratings[comp.key];
            const isMeets = currentScore >= 4.0;
            const isWarn = currentScore >= 3.0 && currentScore < 4.0;

            return (
              <div
                key={comp.key}
                className="bg-surface border border-line rounded-float p-5 sm:p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-mono font-semibold text-accent uppercase tracking-wider">
                      Competency {idx + 1} of 5
                    </span>
                    <h3 className="text-base font-semibold text-ink">{comp.label}</h3>
                    <p className="text-xs text-ink-2 leading-relaxed">{comp.desc}</p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="font-mono text-lg font-bold text-ink">
                      {currentScore.toFixed(1)}
                    </span>
                    <Badge variant={isMeets ? 'ok' : isWarn ? 'warn' : 'bad'}>
                      {isMeets ? 'Meets (>= 4.0)' : isWarn ? 'Developing' : 'Critical Gap'}
                    </Badge>
                  </div>
                </div>

                {/* Score Selector Scale (1.0 to 5.0) */}
                <div className="pt-2">
                  <div className="flex items-center justify-between gap-1 sm:gap-2">
                    {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((score) => {
                      const isSelected = currentScore === score;
                      const isTarget = score === 4.0;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleRatingChange(comp.key, score)}
                          className={`flex-1 h-9 rounded-ctl border text-xs font-mono font-medium transition-all relative ${
                            isSelected
                              ? 'bg-accent text-accent-foreground border-accent shadow-xs scale-105 z-10'
                              : 'bg-hover/80 text-ink border-line hover:border-ink-3'
                          }`}
                        >
                          <span>{score.toFixed(1)}</span>
                          {isTarget && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-sans font-bold text-ink-3 bg-bg px-1 rounded shadow-xs"
                              title="Target Regularizing Benchmark"
                            >
                              Target
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[11px] text-ink-3 mt-1.5 px-0.5 font-mono">
                    <span>1.0 Unsatisfactory</span>
                    <span>3.0 Minimum Pass</span>
                    <span>5.0 Exceptional</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Behavioral Remarks & Summary Card */}
        <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div>
              <h3 className="text-base font-semibold text-ink">Overall Evaluation Summary</h3>
              <p className="text-xs text-ink-3 mt-0.5">
                Calculated across the 5 statutory competencies
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-ink-3 font-mono block">Overall Score</span>
                <span className="text-2xl font-bold font-mono text-ink">
                  {overallAverage.toFixed(1)} <span className="text-xs text-ink-3">/ 5.0</span>
                </span>
              </div>
              <Badge variant={overallAverage >= 4.0 ? 'ok' : overallAverage >= 3.0 ? 'warn' : 'bad'}>
                {overallAverage >= 4.0
                  ? 'On Track for Regularization'
                  : overallAverage >= 3.0
                  ? 'Needs Targeted Coaching'
                  : 'Critical Non-Regularization Risk'}
              </Badge>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-ink" htmlFor="remarks">
                Evidentiary Behavioral Remarks *
              </label>
              <span className="text-[11px] text-ink-3 font-mono">
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
              placeholder="Detail specific behavioral evidence, projects completed, coaching provided, and concrete milestones achieved this week..."
              className="w-full p-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-[11px] text-ink-3 mt-1.5 leading-relaxed flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>
                Required under Philippine Labor Code Article 296 to sustain any regularizing or non-regularizing action before DOLE.
              </span>
            </p>
          </div>

          <div className="flex justify-end pt-3">
            <Button type="submit" variant="primary" size="lg" leftIcon={Award}>
              Submit Evaluation
            </Button>
          </div>
        </section>
      </form>

      {/* Immutable Confirmation Modal */}
      {isConfirmModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsConfirmModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-surface border border-line rounded-float shadow-pop p-6 sm:p-7 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-line">
              <div className="w-9 h-9 rounded-nav bg-warn/10 text-warn flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Confirm Immutable Evaluation Submission
                </h3>
                <p className="text-xs text-ink-3">Article 296 Evidentiary Logging</p>
              </div>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed">
              You are submitting a weekly performance rating of{' '}
              <b className="font-mono text-ink">{overallAverage.toFixed(1)} / 5.0</b> for{' '}
              <b className="text-ink">{selectedEmployee?.user?.full_name}</b>.
            </p>

            <div className="p-3.5 rounded-ctl bg-hover border border-line text-xs text-ink-3 space-y-1">
              <span className="font-semibold text-ink block">Legal Notice on Audit Trail:</span>
              <p className="leading-relaxed">
                Under Philippine labor jurisprudence, evaluations once entered into the platform are permanently hashed into the audit trail. They cannot be retracted, edited, or deleted.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
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
          </div>
        </div>
      )}
    </div>
  );
}
