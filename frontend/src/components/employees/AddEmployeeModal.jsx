import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { manilaTodayISO, addDays, formatDate } from '../../utils/datetime';
import { PROBATION_DAYS } from '../../config/domain';
import { Button, Modal, TextField, GlideSelect } from '../ui';
import { X, AlertCircle, Lock } from '../icons';

export default function AddEmployeeModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [jobTitle, setJobTitle] = useState('');
  const [startDate, setStartDate] = useState(manilaTodayISO);
  const [supervisorId, setSupervisorId] = useState('');
  const [error, setError] = useState('');

  // Load assignable supervisors for this tenant (only while the modal is open,
  // so non-employer roles viewing the directory don't fire a forbidden request).
  const { data: supervisors = [], isLoading: isSupervisorsLoading } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => employeeApi.listSupervisors(),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!supervisorId && supervisors.length > 0) {
      setSupervisorId(supervisors[0].id);
    }
  }, [supervisors, supervisorId]);

  // Calculate Day 180 preview (start + PROBATION_DAYS) via the shared helper.
  const calculateDay180 = (start) => {
    const d = addDays(start, PROBATION_DAYS);
    return d ? formatDate(d) : '';
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
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      label="Onboard probationary employee"
      maxWidth="max-w-lg"
      panelClassName="sm:p-7"
    >
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-line">
          <div>
            <h2 className="text-16 font-semibold text-ink">Onboard Probationary Employee</h2>
            <p className="text-12 text-ink-3">Article 296 · 180-day probation timeline</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1 rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-ctl bg-bad/8 border border-line text-bad text-12 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            id="m_name"
            label="Full Name *"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Maria Clara Santos"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              id="m_email"
              label="Work Email *"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@acme.com"
            />

            <div>
              <TextField
                id="m_dept"
                label="Department *"
                type="text"
                list="department-suggestions"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
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
            <TextField
              id="m_title"
              label="Job Title *"
              type="text"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Junior Systems Dev"
            />

            <TextField
              id="m_start"
              label="Start Date (Asia/Manila) *"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="[&_input]:font-num"
            />
          </div>

          <div>
            <label className="block text-12 font-medium text-ink-2 mb-1" htmlFor="m_supervisor">
              Assigned Supervisor *
            </label>
            <GlideSelect
              id="m_supervisor"
              className="glide-select--field"
              ariaLabel="Assigned Supervisor"
              value={supervisorId}
              onChange={(value) => setSupervisorId(value)}
              disabled={isSupervisorsLoading || supervisors.length === 0}
              options={
                supervisors.length === 0
                  ? [
                      {
                        value: '',
                        label: isSupervisorsLoading
                          ? 'Loading supervisors…'
                          : 'No supervisors available',
                      },
                    ]
                  : supervisors.map((s) => ({
                      value: s.id,
                      label: `${s.full_name} (${s.email})`,
                    }))
              }
            />
            {!isSupervisorsLoading && supervisors.length === 0 && (
              <p className="text-12 text-warn mt-1">
                Create a Supervisor account first before onboarding an employee.
              </p>
            )}
          </div>

          {/* Statutory 180-Day Calculation Banner */}
          <div className="p-3 rounded-ctl bg-hover border border-line text-12 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-ink-3 font-num text-12">Statutory 180-Day Cap</span>
              <span className="font-semibold text-accent font-num">{day180Preview}</span>
            </div>
            <p className="text-12 text-ink-3 leading-relaxed">
              Under Art. 296, the employee will automatically regularize if retained past Day 180 without formal notice.
            </p>
          </div>

          {/* Credentials are generated + emailed server-side (no hard-coded password) */}
          <div className="flex items-start gap-2 p-3 rounded-ctl bg-hover border border-line text-12 text-ink-2">
            <Lock className="w-4 h-4 shrink-0 text-accent mt-0.5" />
            <span>
              A secure temporary password is generated automatically and emailed to the
              employee. You never see or set it.
            </span>
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-line">
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
    </Modal>
  );
}
