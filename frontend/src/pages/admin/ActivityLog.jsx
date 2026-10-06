import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, getApiErrorMessage } from '../../api';
import { formatDate } from '../../utils/datetime';
import { Button, Badge, Skeleton, EmptyState, Card, Page } from '../../components/ui';
import { History, AlertCircle } from '../../components/icons';

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

  return (
    <Page
        title="System Activity Log"
        subtitle="User actions across the tenant · newest first"
    >

      <Card padded={false} className="overflow-hidden">
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
        ) : entries.length === 0 ? (
          <EmptyState icon={History} title="No activity recorded">
            Logins and record changes will appear here.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-12">
              <caption className="sr-only">System activity log</caption>
              <thead>
                <tr className="border-b border-line text-12 font-medium text-ink-3 uppercase tracking-wider bg-hover/40">
                  <th scope="col" className="py-3 px-4">Timestamp (Asia/Manila)</th>
                  <th scope="col" className="py-3 px-4">Actor</th>
                  <th scope="col" className="py-3 px-4">Action</th>
                  <th scope="col" className="py-3 px-4">Entity</th>
                  <th scope="col" className="py-3 px-4">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-hover transition-colors">
                    <td className="py-3 px-4 text-ink-2 font-num whitespace-nowrap">
                      {entry.created_at ? formatDate(entry.created_at, { withTime: true }) : ''}
                    </td>
                    <td className="py-3 px-4 font-medium text-ink">
                      <span className="block truncate max-w-[200px]" title={entry.actor_name || ''}>
                        {entry.actor_name || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="accent">{entry.action}</Badge>
                    </td>
                    <td className="py-3 px-4 text-ink-2 font-num">
                      {entry.entity_type || '—'}
                    </td>
                    <td className="py-3 px-4 text-ink-3 font-num">
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
        <footer className="p-3 border-t border-line text-12 text-ink-3 font-num">
          Showing {entries.length} activity entries
        </footer>
      </Card>
    </Page>
  );
}
