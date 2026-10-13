import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { Skeleton, EmptyState, Card, Badge } from '../../components/ui';
import { Users, AlertCircle } from '../../components/icons';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { milestoneFor, formatProbationDay, scoreTone, TONE_BG, TONE_TEXT } from '../../utils/status';
import { TARGET } from '../../config/domain';
import { getInitials } from '../../utils/format';

// Employees directory — the iMac concept's roster: a flat hairline table with
// Employee (avatar · name · title), Department, Day X/180, Overall score and
// Status. Each row opens the record. Scores come from each employee's scorecard
// (no invented numbers); a missing scorecard shows "—".
const STATUS_VARIANT = { active: 'accent', regularized: 'ok', terminated: 'neutral' };

export default function EmployeeList() {
  const navigate = useNavigate();

  const {
    data: employees = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['employees', { limit: 200 }],
    queryFn: () => employeeApi.list({ limit: 200 }),
  });

  const scoreQueries = useQueries({
    queries: employees.map((e) => ({
      queryKey: ['scorecard', e.id],
      // 404 = "no evaluations yet" → null so it renders as "—".
      queryFn: async () => {
        try {
          return (await evaluationApi.getScorecard(e.id)) ?? null;
        } catch {
          return null;
        }
      },
      retry: false,
      staleTime: 60_000,
    })),
  });
  const scoresLoading = scoreQueries.some((q) => q.isLoading);
  const scoreById = useMemo(() => {
    const map = {};
    employees.forEach((e, i) => {
      map[e.id] = scoreQueries[i]?.data || null;
    });
    return map;
  }, [employees, scoreQueries]);

  const rows = useMemo(
    () => [...employees].sort((a, b) => (a.user?.full_name || '').localeCompare(b.user?.full_name || '')),
    [employees]
  );

  return (
    <Card flat padded={false} className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 pb-2 mb-3 border-b border-line">
        <b className="text-12 font-medium text-ink-2">Employees</b>
        <span className="text-12 text-ink-3">
          {employees.length} probationary record{employees.length === 1 ? '' : 's'}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3 pt-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : isError ? (
        <div className="py-10 text-center space-y-2">
          <AlertCircle className="w-6 h-6 mx-auto text-bad" />
          <p className="text-12 text-bad">{getApiErrorMessage(error, 'Failed to load employees.')}</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet">
          Onboard a probationary employee to get started.
        </EmptyState>
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Employees with statutory day count, overall score and status</caption>
          <thead>
            <tr className="border-b border-line text-12 text-ink-3">
              <th scope="col" className="py-2.5 pr-4 font-normal">Employee</th>
              <th scope="col" className="py-2.5 pr-4 font-normal">Department</th>
              <th scope="col" className="py-2.5 pr-4 font-normal">Day</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-normal">Overall</th>
              <th scope="col" className="py-2.5 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((emp) => {
              const days = getDaysElapsed(emp.start_date);
              const { tone } = milestoneFor(days, emp.status);
              const sc = scoreById[emp.id];
              const overall = sc ? Number(sc.overall_score) : null;
              const target = sc ? Number(sc.target_score) || TARGET : TARGET;
              const st = overall != null ? scoreTone(overall, target) : null;
              return (
                <tr
                  key={emp.id}
                  onClick={() => navigate(`/employees/${emp.id}`)}
                  className="cursor-pointer transition-colors hover:bg-hover"
                >
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 shrink-0 rounded-full bg-hover text-ink-2 flex items-center justify-center text-12 font-semibold"
                        aria-hidden="true"
                      >
                        {getInitials(emp.user?.full_name)}
                      </span>
                      <span className="min-w-0">
                        <Link
                          to={`/employees/${emp.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate text-14 font-semibold text-ink hover:underline"
                        >
                          {emp.user?.full_name}
                        </Link>
                        <span className="block truncate text-12 text-ink-3">{emp.job_title}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 truncate text-14 text-ink-2">{emp.department}</td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap text-14 font-num text-ink">
                      <span className={`w-2 h-2 shrink-0 rounded-full ${TONE_BG[tone]}`} aria-hidden="true" />
                      {formatProbationDay(days)}
                    </span>
                  </td>
                  <td
                    className={`py-3 pr-4 text-right text-14 font-semibold font-num ${
                      st ? TONE_TEXT[st] : 'text-ink-3'
                    }`}
                  >
                    {overall != null ? overall.toFixed(2) : scoresLoading ? '…' : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <Badge variant={STATUS_VARIANT[emp.status] || 'neutral'}>{emp.status}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
