import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { Skeleton, EmptyState, inputClass } from '../../components/ui';
import { Search, Users, AlertCircle } from '../../components/icons';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL, PROBATION_DAYS } from '../../config/domain';

const TONE_CLASS = {
  ok: 'text-good',
  warn: 'text-warn',
  notice: 'text-notice',
  bad: 'text-bad',
};

function milestoneFor(employee) {
  if (employee.status !== 'active') return { tone: 'ok', label: 'Regular' };
  const days = getDaysElapsed(employee.start_date);
  if (days >= MILESTONE_CRITICAL) return { tone: 'bad', label: 'Critical' };
  if (days >= MILESTONE_NOTICE) return { tone: 'notice', label: 'Notice' };
  if (days >= MILESTONE_REVIEW) return { tone: 'warn', label: 'Review' };
  return { tone: 'ok', label: 'On track' };
}

// The record list pane of the Employees split view. Selection is the route
// param (:id) so deep links and the browser back button work.
export default function EmployeeList() {
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const [query, setQuery] = useState('');

  const {
    data: employees = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['employees', { limit: 200 }],
    queryFn: () => employeeApi.list({ limit: 200 }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? employees.filter((e) =>
          [e.user?.full_name, e.user?.email, e.job_title, e.department]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(q))
        )
      : employees;
    return [...list].sort(
      (a, b) => getDaysElapsed(b.start_date) - getDaysElapsed(a.start_date)
    );
  }, [employees, query]);

  return (
    <div className="split__list">
      <div className="listhd">
        <div className="listhd__row">
          <h2 className="listhd__t">Employees</h2>
          <span className="count">
            {employees.length} {employees.length === 1 ? 'record' : 'records'}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or title…"
            aria-label="Filter employees"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      <div className="listrows">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-6 text-center space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-bad" />
            <p className="text-12 text-bad">
              {getApiErrorMessage(error, 'Failed to load employees.')}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No employees match">
            Try a different search term.
          </EmptyState>
        ) : (
          filtered.map((emp) => {
            const days = getDaysElapsed(emp.start_date);
            const { tone, label } = milestoneFor(emp);
            const pct = Math.min(100, Math.max(0, (days / PROBATION_DAYS) * 100));
            return (
              <button
                key={emp.id}
                type="button"
                className="lrow"
                aria-current={emp.id === selectedId ? 'true' : undefined}
                onClick={() => navigate(`/employees/${emp.id}`)}
              >
                <span className="lrow__n">{emp.user?.full_name}</span>
                <span className={`lrow__s ${TONE_CLASS[tone]}`}>{label}</span>
                <span className="lrow__m">
                  Day {days} · {emp.job_title}
                </span>
                <span className={`lrow__bar ${TONE_CLASS[tone]}`} aria-hidden="true">
                  <i style={{ width: `${pct}%` }} />
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="listft">
        <span>{filtered.length} of {employees.length} shown</span>
        <span>Article 296</span>
      </div>
    </div>
  );
}
