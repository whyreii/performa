import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, getApiErrorMessage } from '../../api';
import { Button, Badge, Skeleton } from '../../components/ui';
import { History, AlertCircle } from 'lucide-react';

export default function ActivityLog() {
  const {
    data: entries = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => adminApi.listActivity({ limit: 200 }),
  });

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            System Activity Log
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            User actions across the tenant · newest first
          </p>
        </div>
      </header>

      <section className="bg-surface border border-line rounded-float shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <p className="text-xs text-ink-3">
              {getApiErrorMessage(error, 'Failed to load the activity log.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <History className="w-10 h-10 text-ink-3/40 mx-auto" />
            <h3 className="text-base font-medium text-ink">No activity recorded</h3>
            <p className="text-xs text-ink-3">
              Logins and record changes will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-[11px] font-medium text-ink-3 uppercase tracking-wider bg-hover/40">
                  <th className="py-3 px-4">Timestamp (Asia/Manila)</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-hover transition-colors">
                    <td className="py-3 px-4 text-ink-2 font-mono whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="py-3 px-4 font-medium text-ink">
                      {entry.actor_name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="accent">{entry.action}</Badge>
                    </td>
                    <td className="py-3 px-4 text-ink-2 font-mono">
                      {entry.entity_type || '—'}
                    </td>
                    <td className="py-3 px-4 text-ink-3 font-mono truncate max-w-[240px]">
                      {entry.detail || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="p-3 border-t border-line text-xs text-ink-3 font-mono">
          Showing {entries.length} activity entries
        </footer>
      </section>
    </div>
  );
}
