import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import Notifications from './Notifications';
import { notificationApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

const NOTIFICATION = {
  id: 'n-1',
  title: 'Day 150 review due',
  body: 'Maria Midterm reached the Day 150 milestone.',
  category: 'milestone_150',
  is_read: false,
  created_at: '2026-03-01T00:00:00+00:00',
};

beforeEach(() => localStorage.clear());

describe('Notifications', () => {
  it('renders the notifications list and unread count', async () => {
    notificationApi.list.mockResolvedValue([NOTIFICATION]);
    renderWithProviders(<Notifications />, {
      route: '/notifications',
      user: testUser('employer'),
    });
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(await screen.findByText('Day 150 review due')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
  });
});
