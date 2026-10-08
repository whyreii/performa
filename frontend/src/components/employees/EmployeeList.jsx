import React, { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { Skeleton, EmptyState, Card, inputClass, GlideSelect, Th } from '../../components/ui';
import { Search, Users, AlertCircle, ChevronRight } from '../../components/icons';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { milestoneFor, TONE_BG } from '../../utils/status';
import { PROBATION_DAYS, MILESTONE_REVIEW } from '../../config/domain';

// Full-width employees directory table — same visual language as the employer
// dashboard worklist. Search + milestone filter; each row opens the record.
export default function EmployeeList() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [milestone, setMilestone] = useState('all');
  const [sortKey, setSortKey] = useState('day');
  const [sortDir, setSortDir] = useState('desc');
  // Keep typing instant while the (potentially long) list filters in the
  // background — the input stays bound to `query`, the list reads the deferred value.
  const deferredQuery = useDeferredValue(query);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'day' ? 'desc' : 'asc');
    }
  };

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
    const q = deferredQuery.trim().toLowerCase();
    const list = employees.filter((e) => {
      const days = getDaysElapsed(e.start_date);
      if (milestone === 'pastCap' && !(days > PROBATION_DAYS)) return false;
      if (milestone === 'due' && !(days >= MILESTONE_REVIEW && days <= PROBATION_DAYS)) return false;
      if (milestone === 'onTrack' && !(days < MILESTONE_REVIEW)) return false;
      if (!q) return true;
      return [e.user?.full_name, e.user?.email, e.job_title, e.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q));
    });
    return [...list].sort((a, b) => {
      let r = 0;
      if (sortKey === 'name') r = (a.user?.full_name || '').localeCompare(b.user?.full_name || '');
      else if (sortKey === 'role') r = (a.job_title || '').localeCompare(b.job_title || '');
      else if (sortKey === 'dept') r = (a.department || '').localeCompare(b.department || '');
      else r = getDaysElapsed(a.start_date) - getDaysElapsed(b.start_date);
      return sortDir === 'asc' ? r : -r;
    });
  }, [employees, deferredQuery, milestone, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      {/* Filters — table toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, role, or department…"
            aria-label="Search employees"
            className={`${inputClass} pl-9`}
          />
        </div>
        <GlideSelect
          className="glide-select--control"
          ariaLabel="Filter by milestone"
          value={milestone}
          onChange={(value) => setMilestone(value)}
          options={[
            { value: 'all', label: 'All milestones' },
            { value: 'pastCap', label: 'Past cap' },
            { value: 'due', label: 'Decisions due' },
            { value: 'onTrack', label: 'On track' },
          ]}
          showTags={false}
          size="md"
          radius={8}
          menuWidth={200}
        />
      </div>

      <Card padded={false} className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-bad" />
            <p className="text-12 text-bad">
              {getApiErrorMessage(error, 'Failed to load employees.')}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No employees match">
            Try a different search term or filter.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">
                Employees with statutory day count and milestone
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <Th sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 px-4">
                    Employee
                  </Th>
                  <Th sortKey="role" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 px-4">
                    Role
                  </Th>
                  <Th sortKey="dept" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 px-4">
                    Department
                  </Th>
                  <Th sortKey="day" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 px-4">
                    Deadline
                  </Th>
                  <Th align="right" className="py-2.5 px-4">
                    Action
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((emp) => {
                  const days = getDaysElapsed(emp.start_date);
                  const { tone, label } = milestoneFor(days, emp.status);
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="hover:bg-hover cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-semibold text-14 text-ink truncate block">
                          {emp.user?.full_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-14 text-ink-3 truncate">
                        {emp.job_title}
                      </td>
                      <td className="py-3 px-4 text-14 text-ink-3 truncate">
                        {emp.department}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG[tone]}`}
                            aria-hidden="true"
                          />
                          <span className="font-num text-14 text-ink inline-block w-14">
                            Day {days}
                          </span>
                          <span className="text-12 text-ink-3">· {label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-ink-3 inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap justify-between gap-2 text-12 text-ink-3">
        <span>
          Showing {filtered.length} of {employees.length}
        </span>
        <span>Select a row to open the record</span>
      </div>
    </div>
  );
}
