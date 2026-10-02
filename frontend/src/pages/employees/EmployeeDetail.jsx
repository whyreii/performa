import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button, Badge, ScoreMeter, StatusDot, MilestonePill, Skeleton } from '../../components/ui';
import { daysElapsed as getDaysElapsed, parseDateOnly } from '../../utils/datetime';
import {
  ArrowLeft,
  Calendar,
  Building,
  Mail,
  Award,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  UserCheck,
  UserX,
} from 'lucide-react';

const COMPETENCY_DESCRIPTIONS = {
  task_completion: 'Deliverables completed on schedule and adherence to task assignments',
  quality_of_work: 'Accuracy, attention to detail, and compliance with quality standards',
  attendance_and_punctuality: 'On-time arrival and dependability during scheduled hours',
  communication_and_teamwork: 'Cross-functional collaboration and clear status reporting',
  initiative_and_adaptability: 'Self-driven problem solving and agility to change',
};

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('regularized');
  const [statusReason, setStatusReason] = useState('');
  const [actionError, setActionError] = useState('');

  // Fetch employee profile
  const {
    data: employee,
    isLoading: isEmpLoading,
    isError: isEmpError,
    error: empError,
  } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeApi.getById(id),
    enabled: !!id,
  });

  // Fetch scorecard & competencies
  const { data: scorecard, isLoading: isScoreLoading } = useQuery({
    queryKey: ['scorecard', id],
    queryFn: () => evaluationApi.getScorecard(id),
    enabled: !!id,
  });

  // Fetch audit trail history
  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery({
    queryKey: ['audit-trail', id],
    queryFn: () => evaluationApi.getAuditTrail(id),
    enabled: !!id,
  });

  // Status transition mutation (regularize or terminate)
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }) => employeeApi.updateStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsDeactivateModalOpen(false);
    },
    onError: (err) => {
      setActionError(getApiErrorMessage(err, 'Failed to update employee status.'));
    },
  });

  // Standards acknowledgment mutation
  const ackMutation = useMutation({
    mutationFn: () => employeeApi.acknowledgeStandards(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
    },
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (isEmpLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isEmpError || !employee) {
    return (
      <div className="bg-surface border border-line rounded-float p-12 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-bad mx-auto" />
        <h2 className="text-lg font-semibold text-ink">Employee profile not found</h2>
        <p className="text-xs text-ink-3">
          {getApiErrorMessage(empError, 'The requested probationary profile does not exist.')}
        </p>
        <Button variant="secondary" onClick={() => navigate('/employees')}>
          Back to Directory
        </Button>
      </div>
    );
  }

  const daysElapsed = getDaysElapsed(employee.start_date);
  const daysRemaining = Math.max(0, 180 - daysElapsed);
  const progressPct = Math.min(100, Math.round((daysElapsed / 180) * 100));

  const canManageStatus = user?.role === 'admin' || user?.role === 'employer';
  const canRate = user?.role === 'supervisor' || user?.role === 'employer';

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Top Back Navigation */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Directory</span>
        </button>
      </div>

      {/* 1. Header Profile Banner */}
      <section className="bg-surface border border-line rounded-float p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-line">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/25 text-accent font-semibold text-lg flex items-center justify-center shrink-0">
              {getInitials(employee.user?.full_name)}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  {employee.user?.full_name}
                </h1>
                <MilestonePill daysElapsed={daysElapsed} status={employee.status} />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                <span className="font-medium text-ink">{employee.job_title}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-ink-3" />
                  <span>{employee.department}</span>
                </span>
                <span>·</span>
                <span className="font-mono flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-ink-3" />
                  <span>{employee.user?.email}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canRate && employee.status === 'active' && (
              <Button
                variant="primary"
                leftIcon={Award}
                onClick={() => navigate(`/supervisor/rate?employee=${employee.id}`)}
              >
                Rate Employee
              </Button>
            )}

            {canManageStatus && employee.status === 'active' && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedStatus('regularized');
                  setStatusReason('');
                  setActionError('');
                  setIsDeactivateModalOpen(true);
                }}
              >
                Update Status
              </Button>
            )}
          </div>
        </div>

        {/* Initial Standards Notice */}
        <div className="mt-4 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-ink-2">
            <CheckCircle2
              className={`w-4 h-4 ${
                employee.standards_acknowledged_at ? 'text-ok' : 'text-warn'
              }`}
            />
            <span>
              {employee.standards_acknowledged_at ? (
                <>
                  Initial performance standards acknowledged on{' '}
                  <span className="font-mono">
                    {formatDate(employee.standards_acknowledged_at)}
                  </span>
                </>
              ) : (
                'Performance standards not yet acknowledged by employee'
              )}
            </span>
          </div>

          {!employee.standards_acknowledged_at && user?.role === 'probationary_employee' && (
            <Button
              variant="subtle"
              size="sm"
              isLoading={ackMutation.isPending}
              onClick={() => ackMutation.mutate()}
            >
              Sign Acknowledgment
            </Button>
          )}
        </div>
      </section>

      {/* 2. Article 296 Statutory 180-Day Tracker */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span>Article 296 Statutory Probation Tracker</span>
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              Strict 180-day limitation calculated under Asia/Manila standard time
            </p>
          </div>

          <div className="font-mono text-xs text-ink">
            <b>Day {daysElapsed}</b> / 180 ({daysRemaining} days remaining)
          </div>
        </div>

        {/* Timeline Progress Bar */}
        <div className="space-y-2">
          <div className="relative h-3 w-full bg-hover border border-line rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                daysElapsed >= 178
                  ? 'bg-bad'
                  : daysElapsed >= 150
                  ? 'bg-warn'
                  : 'bg-accent'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Milestone markers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono">
            <div className="p-2.5 rounded-ctl bg-hover border border-line">
              <span className="text-ink-3 block">Day 1 (Start)</span>
              <span className="font-semibold text-ink">{formatDate(employee.start_date)}</span>
            </div>

            <div className="p-2.5 rounded-ctl bg-hover border border-line">
              <span className="text-warn block">Day 150 (Review Due)</span>
              <span className="font-semibold text-ink">
                {formatDate(
                  new Date(parseDateOnly(employee.start_date).getTime() + 150 * 86400000)
                )}
              </span>
            </div>

            <div className="p-2.5 rounded-ctl bg-hover border border-line">
              <span className="text-warn block">Day 165 (Notice Due)</span>
              <span className="font-semibold text-ink">
                {formatDate(
                  new Date(parseDateOnly(employee.start_date).getTime() + 165 * 86400000)
                )}
              </span>
            </div>

            <div className="p-2.5 rounded-ctl bg-hover border border-line">
              <span className="text-bad block">Day 180 (Deadline)</span>
              <span className="font-semibold text-ink">{formatDate(employee.day_180_date)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Performance Scorecard & 5 Competencies */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <Award className="w-4 h-4 text-accent" />
              <span>Competency Scorecard & Benchmarks</span>
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              The 5 statutory performance competencies with 4.0 regularizing target
            </p>
          </div>

          {scorecard?.latest_evaluation_date ? (
            <div className="text-right">
              <span className="text-xs text-ink-3 block font-mono">Overall Average</span>
              <span className="text-xl font-bold font-mono text-ink">
                {Number(scorecard.overall_score).toFixed(1)} / 5.0
              </span>
            </div>
          ) : (
            <Badge variant="neutral">Initial Evaluations Pending</Badge>
          )}
        </div>

        {isScoreLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !scorecard || !scorecard.competencies || scorecard.competencies.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
            No evaluations have been submitted for this employee yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {scorecard.competencies.map((comp) => (
              <div key={comp.key} className="p-4 rounded-ctl bg-hover/60 border border-line space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-sm text-ink block">{comp.label}</span>
                    <span className="text-xs text-ink-3 block">
                      {COMPETENCY_DESCRIPTIONS[comp.key] || 'Statutory competency'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-ink shrink-0 ml-2">
                    {Number(comp.score).toFixed(1)}
                  </span>
                </div>
                <ScoreMeter score={comp.score} target={comp.target} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Immutable Evaluation History Audit Trail */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              <span>Immutable Weekly Evaluation History</span>
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              Append-only audit trail meeting Article 296 evidentiary due process
            </p>
          </div>
          <Badge variant="neutral">{auditLogs.length} Records</Badge>
        </div>

        {isAuditLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : auditLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-3">
            No evaluations submitted yet for this employee.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {auditLogs.map((log) => {
              const hasPrior = log.prior_score !== null && log.prior_score !== undefined;
              return (
                <div key={log.id} className="py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {log.evaluator_name || 'Evaluator'}
                      </span>
                      <Badge variant="accent">
                        {log.competency?.replace(/_/g, ' ') || 'score'}
                      </Badge>
                    </div>
                    <span className="font-mono text-ink-3">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-ink-2">
                    <span className="text-ink-3">
                      {hasPrior ? `${Number(log.prior_score).toFixed(1)} → ` : 'Initial → '}
                    </span>
                    <span className="font-bold text-ink">
                      {Number(log.new_score).toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Status Transition Modal */}
      {isDeactivateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Update probationary status"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsDeactivateModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-line rounded-float shadow-pop p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-semibold text-ink">Update Probationary Status</h3>
              <button
                type="button"
                onClick={() => setIsDeactivateModalOpen(false)}
                className="text-ink-3 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-ctl bg-bad/10 text-bad text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <p className="text-xs text-ink-2">
              Select the statutory status decision for <b>{employee.user?.full_name}</b>:
            </p>

            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-ctl border cursor-pointer transition-colors ${
                  selectedStatus === 'regularized'
                    ? 'border-ok bg-ok/5 text-ink'
                    : 'border-line hover:bg-hover'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="regularized"
                  checked={selectedStatus === 'regularized'}
                  onChange={() => setSelectedStatus('regularized')}
                />
                <div>
                  <span className="font-semibold text-xs block text-ok">Confer Regular Status</span>
                  <span className="text-[11px] text-ink-3 block">
                    Employee has passed probationary standards.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-ctl border cursor-pointer transition-colors ${
                  selectedStatus === 'terminated'
                    ? 'border-bad bg-bad/5 text-ink'
                    : 'border-line hover:bg-hover'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="terminated"
                  checked={selectedStatus === 'terminated'}
                  onChange={() => setSelectedStatus('terminated')}
                />
                <div>
                  <span className="font-semibold text-xs block text-bad">Non-Regularize / Terminate</span>
                  <span className="text-[11px] text-ink-3 block">
                    Due to failure to meet initial probationary standards.
                  </span>
                </div>
              </label>
            </div>

            {selectedStatus === 'terminated' && (
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="status_reason">
                  Reason for Termination *
                </label>
                <textarea
                  id="status_reason"
                  rows={3}
                  maxLength={500}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="State the documented, performance-based justification for non-regularization..."
                  className="w-full p-3 text-xs border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent transition-colors"
                />
                <p className="text-[11px] text-ink-3 mt-1 font-mono">
                  {statusReason.length} / 500 characters
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
              <Button
                variant="ghost"
                onClick={() => setIsDeactivateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant={selectedStatus === 'regularized' ? 'primary' : 'danger'}
                isLoading={statusMutation.isPending}
                onClick={() => {
                  if (selectedStatus === 'terminated' && !statusReason.trim()) {
                    setActionError('A reason is required when terminating an employee.');
                    return;
                  }
                  setActionError('');
                  statusMutation.mutate({
                    status: selectedStatus,
                    reason: statusReason.trim() || undefined,
                  });
                }}
              >
                Confirm Decision
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
