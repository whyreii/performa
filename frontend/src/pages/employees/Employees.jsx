import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { employeeApi, getApiErrorMessage } from '../../api';
import { Button, Badge, StatusDot, MilestonePill, Skeleton } from '../../components/ui';
import { daysElapsed as getDaysElapsed } from '../../utils/datetime';
import { getInitials } from '../../utils/format';
import { activateOnKey } from '../../utils/a11y';
import AddEmployeeModal from '../../components/employees/AddEmployeeModal';
import {
  Users,
  Search,
  Plus,
  ArrowUpDown,
  ChevronRight,
  AlertCircle,
  X,
  Filter,
  Flame,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployer = user?.role === 'employer';
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter and sort state
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'prob' | 'reg'
  const [selectedMilestone, setSelectedMilestone] = useState('all'); // 'all' | 'critical178' | 'notice165' | 'appraisal150' | 'nominal'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [sortKey, setSortKey] = useState('day'); // 'name' | 'day'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Article 296 milestone triage only applies to active probationers.
  useEffect(() => {
    if (activeTab !== 'prob') setSelectedMilestone('all');
  }, [activeTab]);

  // Fetch employees list
  const {
    data: employees = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['employees', { limit: 200 }],
    // SMEs operate within 5-30 employees; request the API max so the directory is complete.
    queryFn: () => employeeApi.list({ limit: 200 }),
  });

  // Calculate distinct departments from data
  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach((emp) => {
      if (emp.department) set.add(emp.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Total counts for tab badges
  const counts = useMemo(() => {
    let prob = 0;
    let reg = 0;
    employees.forEach((emp) => {
      if (emp.status === 'active') prob += 1;
      else if (emp.status === 'regularized') reg += 1;
    });
    return { all: employees.length, prob, reg };
  }, [employees]);

  // Article 296 milestone counts for active probationers
  const milestoneCounts = useMemo(() => {
    let critical178 = 0;
    let notice165 = 0;
    let appraisal150 = 0;
    let nominal = 0;

    employees.forEach((emp) => {
      if (emp.status === 'active') {
        const elapsed = getDaysElapsed(emp.start_date);
        if (elapsed >= 178) critical178 += 1;
        else if (elapsed >= 165) notice165 += 1;
        else if (elapsed >= 150) appraisal150 += 1;
        else nominal += 1;
      }
    });

    return { critical178, notice165, appraisal150, nominal };
  }, [employees]);

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((emp) => {
        // Tab filter
        if (activeTab === 'prob' && emp.status !== 'active') return false;
        if (activeTab === 'reg' && emp.status !== 'regularized') return false;

        // Article 296 Milestone filter
        if (selectedMilestone !== 'all') {
          if (emp.status !== 'active') return false;
          const elapsed = getDaysElapsed(emp.start_date);
          if (selectedMilestone === 'critical178' && elapsed < 178) return false;
          if (selectedMilestone === 'notice165' && (elapsed < 165 || elapsed >= 178)) return false;
          if (selectedMilestone === 'appraisal150' && (elapsed < 150 || elapsed >= 165)) return false;
          if (selectedMilestone === 'nominal' && elapsed >= 150) return false;
        }

        // Dept filter
        if (selectedDept !== 'all' && emp.department !== selectedDept) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const name = (emp.user?.full_name || '').toLowerCase();
          const email = (emp.user?.email || '').toLowerCase();
          const dept = (emp.department || '').toLowerCase();
          const title = (emp.job_title || '').toLowerCase();
          if (!name.includes(q) && !email.includes(q) && !dept.includes(q) && !title.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA;
        let valB;

        if (sortKey === 'name') {
          valA = (a.user?.full_name || '').toLowerCase();
          valB = (b.user?.full_name || '').toLowerCase();
        } else if (sortKey === 'day') {
          valA = getDaysElapsed(a.start_date);
          valB = getDaysElapsed(b.start_date);
        } else {
          valA = a.department || '';
          valB = b.department || '';
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [employees, activeTab, selectedMilestone, selectedDept, searchQuery, sortKey, sortDirection]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedDept !== 'all' || selectedMilestone !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDept('all');
    setSelectedMilestone('all');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Employee Directory
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Probationary & Regular Staff · <span className="font-mono text-ink">Acme PH</span>
          </p>
        </div>

        {isEmployer && (
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              leftIcon={Plus}
              onClick={() => setIsAddModalOpen(true)}
            >
              Onboard Employee
            </Button>
          </div>
        )}
      </header>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        {/* Segmented Control Tabs */}
        <div role="tablist" aria-label="Employee filters" className="inline-flex p-1 rounded-nav bg-hover border border-line">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-ctl text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-surface text-ink shadow-xs font-semibold'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span>All Staff</span>
            <span className="ml-1.5 font-mono text-[11px] text-ink-3">({counts.all})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'prob'}
            onClick={() => setActiveTab('prob')}
            className={`px-3 py-1.5 rounded-ctl text-xs font-medium transition-all ${
              activeTab === 'prob'
                ? 'bg-surface text-ink shadow-xs font-semibold'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span>Probationary</span>
            <span className="ml-1.5 font-mono text-[11px] text-ink-3">({counts.prob})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reg'}
            onClick={() => setActiveTab('reg')}
            className={`px-3 py-1.5 rounded-ctl text-xs font-medium transition-all ${
              activeTab === 'reg'
                ? 'bg-surface text-ink shadow-xs font-semibold'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span>Regularized</span>
            <span className="ml-1.5 font-mono text-[11px] text-ink-3">({counts.reg})</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or title..."
              aria-label="Search employees"
              className="w-full h-8 pl-9 pr-3 rounded-ctl border border-line bg-surface text-ink placeholder:text-ink-3 text-xs focus:outline-none focus:border-accent transition-colors shadow-xs"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="h-8 px-2.5 rounded-ctl border border-line bg-surface text-ink text-xs focus:outline-none focus:border-accent transition-colors shadow-xs cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-accent hover:underline flex items-center gap-1 px-1.5 py-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Article 296 Statutory Milestone Quick Filter Pills (active probationers only) */}
      {activeTab === 'prob' && (
      <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
        <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider flex items-center gap-1.5 mr-1">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span>Milestone Triage:</span>
        </span>

        <button
          type="button"
          onClick={() => setSelectedMilestone('all')}
          className={`h-7 px-2.5 rounded-ctl text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
            selectedMilestone === 'all'
              ? 'bg-ink text-surface shadow-xs font-semibold'
              : 'bg-surface border border-line text-ink-2 hover:text-ink hover:bg-hover'
          }`}
        >
          <span>All Statuses</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMilestone('critical178')}
          className={`h-7 px-2.5 rounded-ctl text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
            selectedMilestone === 'critical178'
              ? 'bg-bad text-white shadow-xs font-semibold'
              : 'bg-bad/10 border border-bad/30 text-bad hover:bg-bad/20'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Day 178 Critical ({milestoneCounts.critical178})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMilestone('notice165')}
          className={`h-7 px-2.5 rounded-ctl text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
            selectedMilestone === 'notice165'
              ? 'bg-warn text-white shadow-xs font-semibold'
              : 'bg-warn/10 border border-warn/30 text-warn hover:bg-warn/20'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Day 165 Notice ({milestoneCounts.notice165})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMilestone('appraisal150')}
          className={`h-7 px-2.5 rounded-ctl text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
            selectedMilestone === 'appraisal150'
              ? 'bg-accent text-white shadow-xs font-semibold'
              : 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Day 150 Review ({milestoneCounts.appraisal150})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMilestone('nominal')}
          className={`h-7 px-2.5 rounded-ctl text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
            selectedMilestone === 'nominal'
              ? 'bg-good text-white shadow-xs font-semibold'
              : 'bg-good/10 border border-good/30 text-good hover:bg-good/20'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>On Track (&lt; Day 150) ({milestoneCounts.nominal})</span>
        </button>
      </div>
      )}

      {/* Directory Table */}
      <div className="bg-surface border border-line rounded-float shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-base font-semibold text-ink">Failed to load employees</h3>
            <p className="text-xs text-ink-3 max-w-sm mx-auto">
              {getApiErrorMessage(error, 'An error occurred while fetching tenant employees.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Users className="w-10 h-10 text-ink-3/40 mx-auto" />
            <h3 className="text-base font-medium text-ink">No employees match</h3>
            <p className="text-xs text-ink-3">Try adjusting your filters or search keywords.</p>
            {hasActiveFilters && (
              <Button variant="subtle" size="sm" onClick={clearFilters} className="mt-2">
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards (table columns clip below lg) */}
            <div className="lg:hidden divide-y divide-line">
              {filteredEmployees.map((emp) => {
                const daysElapsed = getDaysElapsed(emp.start_date);
                const daysRemaining = Math.max(0, 180 - daysElapsed);
                const progressPct = Math.min(100, Math.round((daysElapsed / 180) * 100));
                const isRegular = emp.status === 'regularized';

                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    className="w-full text-left p-4 hover:bg-hover transition-colors flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/15 text-accent font-semibold text-xs flex items-center justify-center shrink-0 border border-accent/20">
                        {getInitials(emp.user?.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-ink block truncate">
                          {emp.user?.full_name}
                        </span>
                        <span className="text-xs text-ink-3 font-mono block truncate">
                          {emp.user?.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-ink-2 truncate">
                        {emp.job_title} · {emp.department}
                      </span>
                      {isRegular ? (
                        <span className="text-ok flex items-center gap-1 shrink-0">
                          <StatusDot status="active" />
                          <span>Permanent Regular</span>
                        </span>
                      ) : (
                        <span className="font-mono text-ink-3 shrink-0">
                          Day {daysElapsed} · {daysRemaining}d left
                        </span>
                      )}
                    </div>

                    <MilestonePill daysElapsed={daysElapsed} status={emp.status} />

                    {!isRegular && (
                      <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            daysElapsed >= 178
                              ? 'bg-bad'
                              : daysElapsed >= 165
                              ? 'bg-notice'
                              : daysElapsed >= 150
                              ? 'bg-warn'
                              : 'bg-accent'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-medium text-ink-3 uppercase tracking-wider bg-hover/40">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1.5 hover:text-ink transition-colors"
                    >
                      <span>Employee</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Department & Title</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('day')}
                      className="flex items-center gap-1.5 hover:text-ink transition-colors"
                    >
                      <span>Article 296 Timeline</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Milestone Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {filteredEmployees.map((emp) => {
                  const daysElapsed = getDaysElapsed(emp.start_date);
                  const daysRemaining = Math.max(0, 180 - daysElapsed);
                  const progressPct = Math.min(100, Math.round((daysElapsed / 180) * 100));

                  return (
                    <tr
                      key={emp.id}
                      tabIndex={0}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      onKeyDown={activateOnKey(() => navigate(`/employees/${emp.id}`))}
                      className="hover:bg-hover cursor-pointer transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-semibold text-xs flex items-center justify-center shrink-0 border border-accent/20">
                            {getInitials(emp.user?.full_name)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-ink block truncate group-hover:text-accent transition-colors">
                              {emp.user?.full_name}
                            </span>
                            <span className="text-xs text-ink-3 font-mono block truncate">
                              {emp.user?.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Job Title */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-ink block">{emp.job_title}</span>
                        <span className="text-xs text-ink-3 block">{emp.department}</span>
                      </td>

                      {/* Probation 180-Day Timeline Bar */}
                      <td className="py-3 px-4 min-w-[150px]">
                        {emp.status === 'regularized' ? (
                          <span className="text-xs font-medium text-ok flex items-center gap-1">
                            <StatusDot status="active" />
                            <span>Permanent Regular</span>
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-ink-2 font-mono">
                              <span>Day {daysElapsed}</span>
                              <span className="text-ink-3 text-[11px]">{daysRemaining}d left</span>
                            </div>
                            <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  daysElapsed >= 178
                                    ? 'bg-bad'
                                    : daysElapsed >= 165
                                    ? 'bg-notice'
                                    : daysElapsed >= 150
                                    ? 'bg-warn'
                                    : 'bg-accent'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Statutory Milestone Pill */}
                      <td className="py-3 px-4">
                        <MilestonePill
                          daysElapsed={daysElapsed}
                          status={emp.status}
                        />
                      </td>

                      {/* Action Chevron */}
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-ink-3 group-hover:text-accent group-hover:translate-x-0.5 transition-all inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="p-3 border-t border-line text-xs text-ink-3 font-mono flex items-center justify-between">
          <span>
            Showing {filteredEmployees.length} of {employees.length} employees
          </span>
          <span>Asia/Manila (UTC+8)</span>
        </footer>
      </div>

      {/* Onboard Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
