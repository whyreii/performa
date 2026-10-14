import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi, getApiErrorMessage } from '../../api';
import { formatDate } from '../../utils/datetime';
import { Button, Badge, Skeleton, EmptyState, Page } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCheck, AlertCircle } from '../../components/icons';

// Copy reflects what each role actually receives (backend notification
// categories): Employer → probation milestone alerts; Supervisor → Day 150 for
// their reports; Employee → monthly summaries + training; Admin → system/account
// only (the Admin is view-only and receives no performance alerts).
const COPY_BY_ROLE = {
  admin: {
    empty: 'System and account notifications will appear here.',
  },
  employer: {
    empty: 'You will be alerted here when an employee reaches a Day 150, 165, or 178 milestone.',
  },
  supervisor: {
    empty: 'You will be alerted here when a direct report reaches the Day 150 performance review.',
  },
  probationary_employee: {
    empty: 'You will be alerted here when a performance summary or training plan is shared with you.',
  },
};

// "milestone_150" -> "Milestone", "summary" -> "Summary", "training" -> "Training".
const categoryLabel = (c) => {
  if (!c) return '';
  const base = String(c).replace(/_\d+$/, '');
  return base.charAt(0).toUpperCase() + base.slice(1).replace(/_/g, ' ');
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const copy = COPY_BY_ROLE[user?.role] || COPY_BY_ROLE.probationary_employee;

  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list(),
    // Notifications change rarely; keep them warm so revisits render instantly,
    // and poll every minute so milestone alerts appear without a manual refresh.
    staleTime: 60_000,
    refetchInterval: 60_000,
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
    <Page
        title="Notifications"
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
    >

      {/* The toolbar carries the page title; the body is just the list. */}
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
            <p className="text-12 text-ink-3">
              {getApiErrorMessage(error, 'Failed to load notifications.')}
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications">
            {copy.empty}
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
                      {n.category && <Badge variant="neutral">{categoryLabel(n.category)}</Badge>}
                      <span className="font-semibold text-14 text-ink">{n.title}</span>
                      <span className="sr-only">{n.is_read ? 'Read' : 'Unread'}</span>
                    </div>
                    {n.body && <p className="text-14 text-ink-2 mt-0.5">{n.body}</p>}
                    <span className="text-12 text-ink-3 font-num mt-1 block">
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
    </Page>
  );
}
