import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { Skeleton, EmptyState, Card, Th, SectionHead } from '../../components/ui';
import { Users, AlertCircle, Download } from '../../components/icons';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { milestoneFor, milestoneStage, formatProbationDay, stageShort, scoreTone, TONE_BG, TONE_TEXT } from '../../utils/status';
import { TARGET } from '../../config/domain';
import { getInitials } from '../../utils/format';

// Probationary roster — a flat hairline table with Employee (avatar · name ·
// title), Department, probation day, latest-week overall score and stage. Each
// row opens the record (click, hover, focus-visible, Enter/Space). Scores come
// from each employee's scorecard (no invented numbers); a missing scorecard shows
// "No score yet". Default order is by urgency (past cap first, then fewest days
// left); the Day and Overall columns are sortable (aria-sort via <Th>).
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

  // The list response already carries each employee's latest-week score, so the
  // roster makes one request, not one per employee.
  const scoreById = useMemo(
    () =>
      Object.fromEntries(
        employees.map((e) => [
          e.id,
          e.latest_overall_score == null ? null : { overall_score: e.latest_overall_score },
        ])
      ),
    [employees]
  );

  // Default: urgency — the largest day count (past cap) first, then nearest cap.
  const [sort, setSort] = useState({ key: 'day', dir: 'desc' });
  const onSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const rows = useMemo(() => {
    const list = [...employees];
    const scoreOf = (e) => {
      const sc = scoreById[e.id];
      return sc ? Number(sc.overall_score) : null;
    };
    // Stage sorts by severity (most urgent first), not the label string.
    const STAGE_RANK = { past: 0, bad: 1, notice: 2, warn: 3, ok: 4, regularized: 5, terminated: 5 };
    const keyOf = (e) => {
      switch (sort.key) {
        case 'name':
          return (e.user?.full_name || '').toLowerCase();
        case 'department':
          return (e.department || '').toLowerCase();
        case 'stage':
          return STAGE_RANK[milestoneStage(getDaysElapsed(e.start_date), e.status).key] ?? 9;
        case 'overall':
          return scoreOf(e);
        default:
          return getDaysElapsed(e.start_date);
      }
    };
    list.sort((a, b) => {
      // Unrated rows stay last for the Overall column, regardless of direction.
      if (sort.key === 'overall') {
        const av = scoreOf(a);
        const bv = scoreOf(b);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        const r = av - bv;
        return sort.dir === 'asc' ? r : -r;
      }
      const ka = keyOf(a);
      const kb = keyOf(b);
      const r = ka < kb ? -1 : ka > kb ? 1 : 0;
      return sort.dir === 'asc' ? r : -r;
    });
    return list;
  }, [employees, scoreById, sort]);

  const openRow = (id) => navigate(`/employees/${id}`);

  // Roster export — the full list is already loaded, so this is a client-side CSV.
  const handleExportCsv = () => {
    const cell = (value) => {
      const text = value == null ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = [
      'Name',
      'Email',
      'Department',
      'Job title',
      'Probation day',
      'Start date',
      'Day 180 date',
      'Overall score',
      'Stage',
    ];
    const lines = [header.join(',')];
    rows.forEach((e) => {
      const sc = scoreById[e.id];
      const days = getDaysElapsed(e.start_date);
      lines.push(
        [
          e.user?.full_name || '',
          e.user?.email || '',
          e.department || '',
          e.job_title || '',
          days,
          e.start_date || '',
          e.day_180_date || '',
          sc ? Number(sc.overall_score).toFixed(2) : '',
          stageShort(days, e.status),
        ]
          .map(cell)
          .join(',')
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employees.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <Card flat padded={false} className="space-y-1">
      <SectionHead
        title="Probationary employees"
        subtitle={`${employees.length} probationary employee${employees.length === 1 ? '' : 's'}`}
        note={
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline disabled:cursor-default disabled:text-ink-3 disabled:no-underline"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        }
      />

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
          <caption className="sr-only">
            Probationary employees with their probation day, latest-week score and stage
          </caption>
          <thead>
            <tr className="border-b border-line text-12 text-ink-3">
              <Th sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={onSort} className="py-2.5 pr-4">
                Employee
              </Th>
              <Th sortKey="department" activeKey={sort.key} dir={sort.dir} onSort={onSort} className="py-2.5 pr-4">
                Department
              </Th>
              <Th sortKey="day" activeKey={sort.key} dir={sort.dir} onSort={onSort} className="py-2.5 pr-4">
                Day
              </Th>
              <Th
                sortKey="overall"
                activeKey={sort.key}
                dir={sort.dir}
                onSort={onSort}
                align="right"
                className="py-2.5 pr-4"
              >
                Overall (latest week)
              </Th>
              <Th sortKey="stage" activeKey={sort.key} dir={sort.dir} onSort={onSort} align="right" className="py-2.5">
                Stage
              </Th>
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
                  tabIndex={0}
                  onClick={() => openRow(emp.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openRow(emp.id);
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-hover focus-visible:bg-hover"
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
                    {overall != null ? (
                      <>
                        {overall.toFixed(2)}
                        <span className="sr-only">
                          {st === 'ok'
                            ? ' meets the standard'
                            : st === 'warn'
                            ? ' below the standard'
                            : ' critical gap'}
                        </span>
                      </>
                    ) : (
                      'No score yet'
                    )}
                  </td>
                  <td className="py-3 text-right text-14 text-ink-2">
                    {stageShort(days, emp.status)}
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
