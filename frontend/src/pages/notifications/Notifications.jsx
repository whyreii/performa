import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi, getApiErrorMessage } from '../../api';
import { formatDate } from '../../utils/datetime';
import { Button, Badge, Skeleton, EmptyState, Card, PageHeader } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { Bell, CheckCheck, AlertCircle } from 'lucide-react';

export default function Notifications() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list(),
    // Notifications change rarely; keep them warm so revisits render instantly.
    staleTime: 60_000,
  });

  const readMutation = useMutation({
    mutationFn: (id) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to mark notification as read.')),
  });

  const readAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to mark all as read.')),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <PageHeader
        title="Notifications"
        subtitle="In-app alerts for summaries, training, and milestones"
        actions={
          <>
            {unreadCount > 0 && <Badge variant="accent">{unreadCount} unread</Badge>}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={CheckCheck}
              disabled={unreadCount === 0 || readAllMutation.isPending}
              onClick={() => readAllMutation.mutate()}
            >
              Mark all read
            </Button>
          </>
        }
      />

      <Card padded={false} className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-line" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 flex items-start gap-3">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-hover/80 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <p className="text-xs text-ink-3">
              {getApiErrorMessage(error, 'Failed to load notifications.')}
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications">
            You will be alerted here when new summaries or training plans arrive.
          </EmptyState>
        ) : (
          <div className="divide-y divide-line">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  n.is_read ? '' : 'bg-accent/5'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      n.is_read ? 'bg-ink-3/30' : 'bg-accent'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">{n.title}</span>
                      <span className="sr-only">{n.is_read ? 'Read' : 'Unread'}</span>
                      {n.category && <Badge variant="neutral">{n.category}</Badge>}
                    </div>
                    {n.body && <p className="text-xs text-ink-2 mt-0.5">{n.body}</p>}
                    <span className="text-12 text-ink-3 font-mono mt-1 block">
                      {n.created_at ? formatDate(n.created_at, { withTime: true, seconds: false }) : ''}
                    </span>
                  </div>
                </div>
                {!n.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={readMutation.isPending}
                    onClick={() => readMutation.mutate(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
