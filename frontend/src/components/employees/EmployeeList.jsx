import React, { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Button,
  Col,
  EmptyState,
  GlideSelect,
  Hero,
  ListHead,
  ListRow,
  MilestoneRail,
  PageGrid,
  Row,
  Section,
  Skeleton,
  inputClass,
} from '../../components/ui';
import { AlertCircle, Plus, Search, Users } from '../../components/icons';
import {
  daysElapsed as getDaysElapsed,
  formatDate,
  manilaTodayLabel,
  milestoneDate,
} from '../../utils/datetime';
import { milestoneFor, TONE_BG } from '../../utils/status';
import {
  MILESTONE_CRITICAL,
  MILESTONE_NOTICE,
  MILESTONE_REVIEW,
  PROBATION_DAYS,
} from '../../config/domain';
import AddEmployeeModal from './AddEmployeeModal';

// One row of the directory: name + role, the statutory day rail, the deadline,
// and the action. The row opens the record (the link is the keyboard control).
function DirectoryRow({ employee, action, onOpen }) {
  const days = getDaysElapsed(employee.start_date);
  const { tone, label } = milestoneFor(days, employee.status);
  const end = milestoneDate(employee.start_date, PROBATION_DAYS);
  const left = PROBATION_DAYS - days;
  const leftLabel =
    left > 0 ? `${left} day${left === 1 ? '' : 's'} left` : left === 0 ? 'Due today' : 'Past the cap';
  return (
    <ListRow onClick={onOpen} className="cursor-pointer">
      <Col span={3} className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG[tone]}`} aria-hidden="true" />
          <Link
            to={`/employees/${employee.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-14 text-ink truncate hover:underline"
          >
            {employee.user?.full_name}
          </Link>
        </div>
        <div className="text-12 text-ink-3 mt-0.5 pl-4 truncate">
          {employee.job_title}
          {employee.department ? ` · ${employee.department}` : ''}
        </div>
      </Col>
      <Col span={4} className="mt-4 lg:mt-0">
        <MilestoneRail day={days} tone={tone} label={label} />
      </Col>
      <Col span={2} className="mt-4 lg:mt-0">
        <div className="font-num text-14 font-medium text-ink">{formatDate(end)}</div>
        <div className="text-12 text-ink-3 mt-0.5">{leftLabel}</div>
      </Col>
      <Col span={1} className="mt-4 lg:mt-0 lg:justify-self-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {action}
        </Button>
      </Col>
    </ListRow>
  );
}

// Employees directory — the minimal system's list shape (docs/LAYOUT_GRAMMAR.md):
// a hero (the pipeline count + the nearest deadline), then the decision-window
// and evaluation sections of 80px rows carrying the statutory day rail. Search
// and the milestone filter stay; selecting a row opens the record.
export default function EmployeeList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const canOnboard = user?.role === 'employer';
  const [query, setQuery] = useState('');
  const [milestone, setMilestone] = useState('all');
  // Keep typing instant while the (potentially long) list filters in the
  // background — the input stays bound to `query`, the list reads the deferred value.
  const deferredQuery = useDeferredValue(query);

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
    return employees.filter((e) => {
      const days = getDaysElapsed(e.start_date);
      if (milestone === 'pastCap' && !(days > PROBATION_DAYS)) return false;
      if (milestone === 'due' && !(days >= MILESTONE_REVIEW && days <= PROBATION_DAYS)) return false;
      if (milestone === 'onTrack' && !(days < MILESTONE_REVIEW)) return false;
      if (!q) return true;
      return [e.user?.full_name, e.user?.email, e.job_title, e.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [employees, deferredQuery, milestone]);

  // The statutory sections: decision-window first (most urgent first), then
  // everyone still inside the term.
  const sections = useMemo(() => {
    const byDaysDesc = (a, b) => getDaysElapsed(b.start_date) - getDaysElapsed(a.start_date);
    const decision = filtered
      .filter((e) => getDaysElapsed(e.start_date) >= MILESTONE_REVIEW)
      .sort(byDaysDesc);
    const evaluation = filtered
      .filter((e) => getDaysElapsed(e.start_date) < MILESTONE_REVIEW)
      .sort(byDaysDesc);
    return [
      {
        key: 'decision',
        index: 1,
        title: 'Needs a decision',
        gutter: 'Review, notice or critical action window.',
        action: 'Review',
        rows: decision,
      },
      {
        key: 'evaluation',
        index: 2,
        title: 'In evaluation',
        gutter: `Before Day ${MILESTONE_REVIEW}.`,
        action: 'Open',
        rows: evaluation,
      },
    ];
  }, [filtered]);

  const nearest = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active');
    if (!active.length) return null;
    return [...active].sort(
      (a, b) => getDaysElapsed(b.start_date) - getDaysElapsed(a.start_date)
    )[0];
  }, [employees]);

  const nearestLeft = nearest ? PROBATION_DAYS - getDaysElapsed(nearest.start_date) : null;

  return (
    <PageGrid>
      <Hero
        title="Employees"
        context={manilaTodayLabel()}
        figure={isLoading ? '–' : employees.length}
        label="in the pipeline"
        side={
          <div>
            {nearest ? (
              <>
                <div className="text-12 text-ink-3">Nearest deadline</div>
                <div className="text-16 font-semibold tracking-tight text-ink mt-1">
                  {nearest.user?.full_name}
                </div>
                <p className="text-14 text-ink-2 mt-0.5">
                  <span className="font-num">
                    {formatDate(milestoneDate(nearest.start_date, PROBATION_DAYS))}
                  </span>
                  {' · '}
                  {nearestLeft > 0
                    ? `${nearestLeft} day${nearestLeft === 1 ? '' : 's'} left`
                    : nearestLeft === 0
                      ? 'Due today'
                      : 'Past the cap'}
                </p>
              </>
            ) : null}
            {canOnboard ? (
              <Button className="mt-5" leftIcon={Plus} onClick={() => setIsAddOpen(true)}>
                Add employee
              </Button>
            ) : null}
            <ul className="mt-7 space-y-1.5 text-12 text-ink-2">
              <li className="flex items-center gap-2.5">
                <i className="w-3.5 h-1.5 rounded-full bg-warn/30" aria-hidden="true" />
                Day {MILESTONE_REVIEW} review due
              </li>
              <li className="flex items-center gap-2.5">
                <i className="w-3.5 h-1.5 rounded-full bg-warn/[0.55]" aria-hidden="true" />
                Day {MILESTONE_NOTICE} notice window
              </li>
              <li className="flex items-center gap-2.5">
                <i className="w-3.5 h-1.5 rounded-full bg-bad/60" aria-hidden="true" />
                Day {MILESTONE_CRITICAL} critical action
              </li>
            </ul>
          </div>
        }
      />

      <Row className="pb-4">
        <Col span={10} start={3}>
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
        </Col>
      </Row>

      {isLoading ? (
        <Row className="pb-8">
          <Col span={10} start={3}>
            <div className="space-y-3 pt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          </Col>
        </Row>
      ) : isError ? (
        <Row className="pb-8">
          <Col span={10} start={3}>
            <div className="pt-4 text-center space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-bad" />
              <p className="text-12 text-bad">
                {getApiErrorMessage(error, 'Failed to load employees.')}
              </p>
            </div>
          </Col>
        </Row>
      ) : filtered.length === 0 ? (
        <Row className="pb-8">
          <Col span={10} start={3}>
            <EmptyState icon={Users} title="No employees match">
              Try a different search term or filter.
            </EmptyState>
          </Col>
        </Row>
      ) : (
        <>
          {sections.map((section) =>
            section.rows.length ? (
              <Section
                key={section.key}
                index={section.index}
                gutter={section.gutter}
                title={section.title}
                note={String(section.rows.length)}
              >
                <ListHead>
                  <Col span={3}>Employee</Col>
                  <Col span={4}>Progress to Day {PROBATION_DAYS}</Col>
                  <Col span={2}>Deadline</Col>
                </ListHead>
                {section.rows.map((emp) => (
                  <DirectoryRow
                    key={emp.id}
                    employee={emp}
                    action={section.action}
                    onOpen={() => navigate(`/employees/${emp.id}`)}
                  />
                ))}
              </Section>
            ) : null
          )}
          <Row className="pt-6">
            <Col span={10} start={3}>
              <p className="text-12 text-ink-3">
                Showing {filtered.length} of {employees.length} · the rail runs the full Day 0–
                {PROBATION_DAYS} term until Day {MILESTONE_REVIEW}, then zooms into the Day{' '}
                {MILESTONE_REVIEW}–{PROBATION_DAYS} decision window.
              </p>
            </Col>
          </Row>
        </>
      )}

      {canOnboard && (
        <AddEmployeeModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      )}
    </PageGrid>
  );
}
