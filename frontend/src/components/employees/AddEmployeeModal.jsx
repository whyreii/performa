import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { manilaTodayISO } from '../../utils/datetime';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Button } from '../ui';
import { X, UserPlus, AlertCircle, Calendar, ShieldCheck, UserCog } from 'lucide-react';

export default function AddEmployeeModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();

  useEscapeKey(onClose, isOpen);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [jobTitle, setJobTitle] = useState('');
  const [startDate, setStartDate] = useState(manilaTodayISO);
  const [password, setPassword] = useState('Password123!');
  const [supervisorId, setSupervisorId] = useState('');
  const [error, setError] = useState('');

  // Load assignable supervisors for this tenant
  const { data: supervisors = [], isLoading: isSupervisorsLoading } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => employeeApi.listSupervisors(),
  });

  useEffect(() => {
    if (!supervisorId && supervisors.length > 0) {
      setSupervisorId(supervisors[0].id);
    }
  }, [supervisors, supervisorId]);

  // Calculate Day 180 preview (+180 days)
  const calculateDay180 = (start) => {
    if (!start) return '';
    try {
      const d = new Date(start);
      d.setDate(d.getDate() + 180);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const day180Preview = calculateDay180(startDate);

  const createMutation = useMutation({
    mutationFn: (newEmployee) => employeeApi.create(newEmployee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      onClose();
      // Reset form
      setFullName('');
      setEmail('');
      setDepartment('Engineering');
      setJobTitle('');
      setStartDate(manilaTodayISO());
      setPassword('Password123!');
      setSupervisorId('');
      setError('');
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Failed to onboard employee.'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (
      !fullName.trim() ||
      !email.trim() ||
      !department.trim() ||
      !jobTitle.trim() ||
      !startDate
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!supervisorId) {
      setError('Please assign a supervisor for this employee.');
      return;
    }

    createMutation.mutate({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim(),
      job_title: jobTitle.trim(),
      start_date: startDate,
      supervisor_id: supervisorId,
      password: password || 'Password123!',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Onboard probationary employee"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-float shadow-pop overflow-hidden p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-nav bg-accent/10 text-accent flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Onboard Probationary Employee</h2>
              <p className="text-xs text-ink-3">Article 296 Statutory 180-Day Timeline</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-ctl bg-bad/8 border border-line text-bad text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="m_name">
              Full Name *
            </label>
            <input
              id="m_name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Maria Clara Santos"
              className="w-full h-9 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="m_email">
                Work Email *
              </label>
              <input
                id="m_email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@acme.com"
                className="w-full h-9 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="m_dept">
                Department *
              </label>
              <input
                id="m_dept"
                type="text"
                list="department-suggestions"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
                className="w-full h-9 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
              />
              <datalist id="department-suggestions">
                <option value="Engineering" />
                <option value="Operations" />
                <option value="Finance" />
                <option value="Customer Support" />
                <option value="Marketing" />
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="m_title">
                Job Title *
              </label>
              <input
                id="m_title"
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Junior Systems Dev"
                className="w-full h-9 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="m_start">
                Start Date (Asia/Manila) *
              </label>
              <input
                id="m_start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 border border-line rounded-field bg-transparent text-ink text-sm focus:outline-none focus:border-accent transition-colors font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1" htmlFor="m_supervisor">
              Assigned Supervisor *
            </label>
            <div className="relative">
              <UserCog className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="m_supervisor"
                required
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                disabled={isSupervisorsLoading || supervisors.length === 0}
                className="w-full h-9 pl-9 pr-3 border border-line rounded-field bg-transparent text-ink text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-60"
              >
                {supervisors.length === 0 ? (
                  <option value="">
                    {isSupervisorsLoading ? 'Loading supervisors…' : 'No supervisors available'}
                  </option>
                ) : (
                  supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.email})
                    </option>
                  ))
                )}
              </select>
            </div>
            {!isSupervisorsLoading && supervisors.length === 0 && (
              <p className="text-[11px] text-warn mt-1">
                Create a Supervisor account first before onboarding an employee.
              </p>
            )}
          </div>

          {/* Statutory 180-Day Calculation Banner */}
          <div className="p-3 rounded-ctl bg-hover border border-line text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-ink-3 flex items-center gap-1 font-mono text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                <span>Statutory 180-Day Cap</span>
              </span>
              <span className="font-semibold text-accent font-mono">{day180Preview}</span>
            </div>
            <p className="text-[11px] text-ink-3 leading-relaxed">
              Under Art. 296, the employee will automatically regularize if retained past Day 180 without formal notice.
            </p>
          </div>

          {/* Initial Password Notice */}
          <div className="flex items-center justify-between pt-2 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-ok" />
              <span>Initial login password:</span>
            </span>
            <span className="font-mono font-medium text-ink">Password123!</span>
          </div>

          <div className="flex justify-end items-center gap-2.5 pt-4 border-t border-line">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
            >
              Onboard Employee
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
