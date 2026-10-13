import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, getApiErrorMessage } from '../../api';
import { formatDate } from '../../utils/datetime';
import {
  Button,
  Badge,
  Skeleton,
  EmptyState,
  Card,
  Page,
  Th,
  inputClass,
  GlideSelect,
} from '../../components/ui';
import { History, AlertCircle, Search } from '../../components/icons';

const PAGE_SIZE = 25;
const SEARCH_FIELDS = ['organization_name', 'actor_name', 'action', 'entity_type', 'detail'];

export default function ActivityLog() {
  const [sortKey, setSortKey] = useState('ts');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);

  const {
    data: entries = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => adminApi.listActivity({ limit: 500 }),
  });

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ts' ? 'desc' : 'asc');
    }
  };

  // Action filter options come from the actions actually present.
  const actionOptions = useMemo(
    () => [...new Set(entries.map((e) => e.action).filter(Boolean))].sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (!q) return true;
      return SEARCH_FIELDS.some((k) => String(e[k] || '').toLowerCase().includes(q));
    });
  }, [entries, searchQuery, actionFilter]);

  const sorted = useMemo(() => {
    const valueOf = (e) => {
      if (sortKey === 'org') return (e.organization_name || e.organization_id || '').toLowerCase();
      if (sortKey === 'actor') return (e.actor_name || '').toLowerCase();
      if (sortKey === 'action') return (e.action || '').toLowerCase();
      if (sortKey === 'entity') return (e.entity_type || '').toLowerCase();
      if (sortKey === 'detail') return (e.detail || '').toLowerCase();
      return e.created_at || '';
    };
    return [...filtered].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const r = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? r : -r;
    });
  }, [filtered, sortKey, sortDir]);

  // Reset to the first page whenever the filters or sort change.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sorted.length);
  const isFiltered = Boolean(searchQuery.trim()) || actionFilter !== 'all';

  return (
    <Page
      title="System Activity Log"
      actions={
        <Button variant="secondary" isLoading={isFetching} onClick={() => refetch()}>
          Refresh
        </Button>
      }
    >
      <Card flat padded={false} className="overflow-hidden">
        {/* Filter and search bar */}
        <div className="p-3 border-b border-line flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actor, action, entity or detail…"
              aria-label="Search activity log"
              className={`${inputClass} pl-9`}
            />
          </div>

          <GlideSelect
            className="glide-select--control"
            ariaLabel="Filter by action"
            value={actionFilter}
            onChange={(value) => setActionFilter(value)}
            options={[
              { value: 'all', label: 'All actions' },
              ...actionOptions.map((a) => ({ value: a, label: a })),
            ]}
            showTags={false}
            accentColor="var(--accent)"
            surfaceColor="var(--surface)"
            highlightColor="var(--hover)"
            textColor="var(--ink)"
            size="md"
            radius={8}
            menuWidth={240}
          />
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <p className="text-12 text-ink-3">
              {getApiErrorMessage(error, 'Failed to load the activity log.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={History} title="No activity found">
            {isFiltered
              ? 'No entries match your filters.'
              : 'Logins and record changes will appear here.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-14">
              <caption className="sr-only">System activity log</caption>
              <thead>
                <tr className="border-b border-line">
                  <Th sortKey="ts" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-3 px-3">
                    Timestamp (Asia/Manila)
                  </Th>
                  <Th sortKey="org" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-3 px-3">
                    Organization
                  </Th>
                  <Th sortKey="actor" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-3 px-3">
                    User
                  </Th>
                  <Th sortKey="action" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-3 px-3">
                    Action
                  </Th>
                  <Th sortKey="entity" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-3 px-3">
                    Entity
                  </Th>
                  <Th sortKey="detail" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-3 px-3">
                    Detail
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((entry) => (
                  <tr key={entry.id} className="hover:bg-hover transition-colors">
                    <td className="py-3 px-3 text-ink-2 font-num whitespace-nowrap">
                      {entry.created_at ? formatDate(entry.created_at, { withTime: true }) : ''}
                    </td>
                    <td className="py-3 px-3 text-ink-2">
                      <span
                        className="block truncate max-w-[180px]"
                        title={entry.organization_name || entry.organization_id || ''}
                      >
                        {entry.organization_name || entry.organization_id || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-ink">
                      <span className="block truncate max-w-[200px]" title={entry.actor_name || ''}>
                        {entry.actor_name || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="accent">{entry.action}</Badge>
                    </td>
                    <td className="py-3 px-3 text-ink-2 font-num">
                      {entry.entity_type || '—'}
                    </td>
                    <td className="py-3 px-3 text-ink-3 font-num">
                      <span className="block truncate max-w-[240px]" title={entry.detail || ''}>
                        {entry.detail || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="p-3 border-t border-line flex flex-wrap items-center justify-between gap-3 text-12 text-ink-3 font-num">
          <span>
            Showing {rangeStart}–{rangeEnd} of {sorted.length}
          </span>
          {sorted.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </footer>
      </Card>
    </Page>
  );
}
