import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AppShell from './AppShell';
import { renderWithProviders } from '../../test/renderWithProviders';
import { testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());
vi.mock('../../routes/loaders', () => ({ prefetchRoute: vi.fn(), routeLoaders: {} }));

beforeEach(() => localStorage.clear());

describe('AppShell', () => {
  it('composes the sidebar, mobile bar, tab bar, and main region', async () => {
    renderWithProviders(<AppShell><div>PAGE CONTENT</div></AppShell>, {
      route: '/dashboard',
      user: testUser('employer'),
    });

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    // The toolbar carries the single timezone reference (date · Asia/Manila).
    expect(await screen.findByText(/Asia\/Manila/)).toBeInTheDocument();
    // Sidebar nav for the employer role.
    expect(screen.getByRole('link', { name: 'Rollups & AI Plans' })).toBeInTheDocument();
    // Mobile navigation tab bar.
    expect(screen.getByRole('navigation', { name: 'Mobile Navigation' })).toBeInTheDocument();
    expect(screen.getByText('PAGE CONTENT')).toBeInTheDocument();
  });

  it('opens the command palette with Ctrl+K and executes a command', async () => {
    renderWithProviders(<AppShell><div>content</div></AppShell>, {
      route: '/dashboard',
      user: testUser('employer'),
    });

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('combobox', { name: 'Search commands' });

    fireEvent.change(input, { target: { value: 'rollup' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the keyboard shortcut guide with "?"', async () => {
    renderWithProviders(<AppShell><div>content</div></AppShell>, {
      route: '/dashboard',
      user: testUser('employer'),
    });

    fireEvent.keyDown(window, { key: '?' });
    expect(await screen.findByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('confirms before signing out from the sidebar', async () => {
    renderWithProviders(<AppShell><div>content</div></AppShell>, {
      route: '/dashboard',
      user: testUser('employer'),
    });

    const signOutButtons = await screen.findAllByRole('button', { name: 'Sign out' });
    fireEvent.click(signOutButtons[0]);
    expect(
      await screen.findByText(
        'You will be signed out of Performa and returned to the login screen.'
      )
    ).toBeInTheDocument();
  });
});
