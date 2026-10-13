import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../api';

// Unread notification count for the shell chrome (the sidebar badge). Shares the
// ['notifications'] cache with the Notifications page, so it adds no extra
// request once that page has loaded.
export function useUnreadNotifications() {
  const { data = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationApi.list()) || [],
  });
  return data.filter((n) => !n.is_read).length;
}
