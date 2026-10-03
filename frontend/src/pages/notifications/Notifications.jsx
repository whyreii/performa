import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi, getApiErrorMessage } from '../../api';
import { formatDate } from '../../utils/datetime';
import { Button, Badge, Skeleton } from '../../components/ui';
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
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Notifications
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            In-app alerts for summaries, training, and milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </header>

      <section className="bg-surface border border-line rounded-float shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <p className="text-xs text-ink-3">
              {getApiErrorMessage(error, 'Failed to load notifications.')}
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Bell className="w-10 h-10 text-ink-3/40 mx-auto" />
            <h3 className="text-base font-medium text-ink">No notifications</h3>
            <p className="text-xs text-ink-3">
              You will be alerted here when new summaries or training plans arrive.
            </p>
          </div>
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
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      n.is_read ? 'bg-ink-3/30' : 'bg-accent'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">{n.title}</span>
                      {n.category && <Badge variant="neutral">{n.category}</Badge>}
                    </div>
                    {n.body && <p className="text-xs text-ink-2 mt-0.5">{n.body}</p>}
                    <span className="text-[11px] text-ink-3 font-mono mt-1 block">
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
      </section>
    </div>
  );
}
