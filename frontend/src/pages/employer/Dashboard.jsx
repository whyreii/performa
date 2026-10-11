import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeApi, interventionApi } from '../../api';
import { Button, Skeleton, Card, Page, CountUp, inputClass, GlideSelect, Th } from '../../components/ui';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { PROBATION_DAYS, MILESTONE_REVIEW, MILESTONE_NOTICE, MILESTONE_CRITICAL } from '../../config/domain';
import { milestoneTone, milestoneFor, nextMilestone, TONE_TEXT, TONE_BG } from '../../utils/status';
import { Users, Award, ChevronRight, Search } from '../../components/icons';

// Employer dashboard — "refined" layout: a flat hairline stat band over a stack
// of panels (action required → probationary employees → AI recommendations).
// Colour = status only; every value comes from the API/DB (no score column —
// the employee list carries no score, so we don't invent one).
const URGENT_MESSAGE = {
  bad: `Working past Day ${PROBATION_DAYS} confers automatic regular status under Article 296. Record a decision or issue written notice.`,
  notice: `Within the Day ${MILESTONE_NOTICE} written-notice window. Prepare the regularization decision.`,
  warn: `The Day ${MILESTONE_REVIEW} performance appraisal is due.`,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dispatch any due statutory milestone alerts (idempotent) on dashboard load.
  useEffect(() => {
    employeeApi
      .scanMilestones()
      .then((res) => {
        if (res?.fired) queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .catch(() => {});
  }, [queryClient]);

  const { data: employees = [], isLoading: isEmpLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const {
    data: plans = [],
    isLoading: isPlansLoading,
    isError: isPlansError,
  } = useQuery({
    queryKey: ['intervention-plans'],
    queryFn: () => interventionApi.listPending(),
  });

  const activeProbationers = useMemo(
    () => employees.filter((e) => e.status === 'active'),
    [employees]
  );

  // Worklist controls — free-text search, statutory milestone filter, column sort.
  const [search, setSearch] = useState('');
  // Default to the action window so the list and its count match the
  // "Decisions due" tile; the dropdown still reveals all milestones.
  const [milestone, setMilestone] = useState('due');
  const [sortKey, setSortKey] = useState('day');
  const [sortDir, setSortDir] = useState('desc');

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'day' ? 'desc' : 'asc');
    }
  };

  const worklist = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = activeProbationers.filter((e) => {
      const days = getDaysElapsed(e.start_date);
      if (milestone === 'pastCap' && !(days > PROBATION_DAYS)) return false;
      if (milestone === 'due' && !(days >= MILESTONE_REVIEW && days <= PROBATION_DAYS)) return false;
      if (milestone === 'onTrack' && !(days < MILESTONE_REVIEW)) return false;
      if (!q) return true;
      return (
        (e.user?.full_name || '').toLowerCase().includes(q) ||
        (e.job_title || '').toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      let r = 0;
      if (sortKey === 'name') r = (a.user?.full_name || '').localeCompare(b.user?.full_name || '');
      else if (sortKey === 'role') r = (a.job_title || '').localeCompare(b.job_title || '');
      else r = getDaysElapsed(a.start_date) - getDaysElapsed(b.start_date);
      return sortDir === 'asc' ? r : -r;
    });
  }, [activeProbationers, search, milestone, sortKey, sortDir]);

  const stats = useMemo(() => {
    let pastCap = 0;
    let decisionsDue = 0;
    let onTrack = 0;
    activeProbationers.forEach((emp) => {
      const d = getDaysElapsed(emp.start_date);
      if (d > PROBATION_DAYS) pastCap += 1;
      else if (d >= MILESTONE_REVIEW) decisionsDue += 1;
      else onTrack += 1;
    });
    return {
      pastCap,
      decisionsDue,
      onTrack,
      pendingPlans: plans.filter((p) => p.status === 'pending_approval').length,
    };
  }, [activeProbationers, plans]);

  // The single most urgent active employee (greatest day count).
  const urgent = useMemo(() => {
    if (activeProbationers.length === 0) return null;
    const top = activeProbationers.reduce((best, emp) =>
      getDaysElapsed(emp.start_date) > getDaysElapsed(best.start_date) ? emp : best
    );
    const days = getDaysElapsed(top.start_date);
    return { emp: top, days, tone: milestoneTone(days) };
  }, [activeProbationers]);

  const showUrgent = urgent && urgent.tone !== 'ok';

  return (
    <Page
      title="Dashboard"
      subtitle={<>Probationary pipeline · Article 296 · <span className="font-num">Asia/Manila</span></>}
      actions={
        <>
          <Button variant="secondary" leftIcon={Users} onClick={() => navigate('/employees')}>
            Directory
          </Button>
          <Button variant="primary" leftIcon={Award} onClick={() => navigate('/supervisor/rate')}>
            Rate staff
          </Button>
        </>
      }
    >
      {/* Stat band — boxed, rounded, hairline-divided (concept) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-float border border-line overflow-hidden">
        <div className="bg-surface px-5 py-4">
          <div className="flex items-center gap-2 text-12 text-ink-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG.bad}`} aria-hidden="true" />
            Past cap · auto-regular
          </div>
          <div className="font-num text-30 font-semibold text-ink mt-2">
            <CountUp value={stats.pastCap} />
          </div>
          <div className="text-12 text-ink-2 mt-2">Past Day {PROBATION_DAYS} · regular by operation of law</div>
        </div>
        <div className="bg-surface px-5 py-4">
          <div className="flex items-center gap-2 text-12 text-ink-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG.warn}`} aria-hidden="true" />
            Decisions due
          </div>
          <div className="font-num text-30 font-semibold text-ink mt-2">
            <CountUp value={stats.decisionsDue} />
          </div>
          <div className="text-12 text-ink-2 mt-2">
            Day {MILESTONE_REVIEW}–{PROBATION_DAYS} window
          </div>
        </div>
        <div className="bg-surface px-5 py-4">
          <div className="flex items-center gap-2 text-12 text-ink-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG.ok}`} aria-hidden="true" />
            On track
          </div>
          <div className="font-num text-30 font-semibold text-ink mt-2">
            <CountUp value={stats.onTrack} />
          </div>
          <div className="text-12 text-ink-2 mt-2">Below Day {MILESTONE_REVIEW}</div>
        </div>
        <div className="bg-surface px-5 py-4">
          <div className="text-12 text-ink-3">Interventions pending</div>
          <div className="font-num text-30 font-semibold text-ink mt-2">
            <CountUp value={stats.pendingPlans} />
          </div>
          <div className="text-12 text-ink-2 mt-2">
            {stats.pendingPlans === 0 ? 'None awaiting sign-off' : 'Awaiting sign-off'}
          </div>
        </div>
      </div>

      {/* Action required before Day 180 */}
      {showUrgent && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-16 font-semibold text-ink">Action required before Day {PROBATION_DAYS}</h2>
            <p className="text-12 text-ink-3 mt-0.5 font-num">
              {urgent.emp.user?.full_name} · Day {urgent.days}
            </p>
          </div>
          <p className="text-14 text-ink-2 leading-relaxed">
            <span className={`font-semibold ${TONE_TEXT[urgent.tone]}`}>
              {milestoneFor(urgent.days, 'active').label}
            </span>{' '}
            {URGENT_MESSAGE[urgent.tone]}
          </p>
        </Card>
      )}

      {/* Worklist — searchable, filterable table; one row per probationer */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-16 font-semibold text-ink">Needs your action</h2>
          <p className="text-12 text-ink-3 mt-0.5">
            {worklist.length} probationary employee
            {worklist.length === 1 ? '' : 's'} · nearest cap first
          </p>
        </div>

        {/* Filters — table toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or role…"
              aria-label="Search probationary employees"
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

        {isEmpLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : activeProbationers.length === 0 ? (
          <p className="py-8 text-center text-14 text-ink-3">
            No active probationary employees in the current tenant.
          </p>
        ) : worklist.length === 0 ? (
          <p className="py-8 text-center text-14 text-ink-3">
            No probationary employees match the current filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">
                Active probationers with statutory day count and milestone
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <Th sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 pr-4">
                    Employee
                  </Th>
                  <Th sortKey="role" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 pr-4">
                    Role
                  </Th>
                  <Th sortKey="day" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 pr-4">
                    Deadline
                  </Th>
                  <Th align="right" className="py-2.5">
                    Action
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {worklist.map((emp) => {
                  const days = getDaysElapsed(emp.start_date);
                  const { tone, label } = milestoneFor(days, emp.status);
                  const next = nextMilestone(days);
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="hover:bg-hover cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          to={`/employees/${emp.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-14 text-ink truncate block"
                        >
                          {emp.user?.full_name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-14 text-ink-3 truncate">
                        {emp.job_title}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${TONE_BG[tone]}`}
                            aria-hidden="true"
                          />
                          <span className="font-num text-14 text-ink inline-block w-14">
                            {next ? `${next - days}d` : 'Past cap'}
                          </span>
                          <span className="text-12 text-ink-3">
                            · {next ? `Day ${next} · ${label}` : label}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <ChevronRight className="w-4 h-4 text-ink-3 inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isEmpLoading && activeProbationers.length > 0 && (
          <div className="flex flex-wrap justify-between gap-2 text-12 text-ink-3">
            <span>
              Showing {worklist.length} of {activeProbationers.length}
            </span>
            <span>Select a row to open the record</span>
          </div>
        )}
      </Card>

      {/* AI recommendations */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-16 font-semibold text-ink">AI recommendations</h2>
          <p className="text-12 text-ink-3 mt-0.5">Random Forest gap classifier</p>
        </div>

        {isPlansLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isPlansError ? (
          <p className="py-6 text-center text-14 text-bad">
            Unable to load AI recommendations right now. Please retry.
          </p>
        ) : plans.length === 0 ? (
          <p className="text-14 text-ink-2">
            All probationary employees are performing at or above benchmark. No active
            intervention plans required.
          </p>
        ) : (
          <ul className="space-y-3">
            {plans.slice(0, 3).map((plan) => (
              <li key={plan.id} className="border-l-2 border-accent pl-3">
                <div className="text-14 font-semibold text-ink">{plan.intervention_title}</div>
                <p className="text-14 text-ink-2 mt-0.5 leading-relaxed">
                  {plan.rationale || plan.competency?.replace(/_/g, ' ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
