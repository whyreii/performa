import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PerformaMark, LogOut, Search, Sun, Moon, ChevronLeft, ChevronRight } from '../icons';
import { ConfirmDialog } from '../ui';
import { sidebarSections } from '../../config/nav';
import { getInitials } from '../../utils/format';
import { modifierKey } from '../../utils/platform';
import { prefetchRoute } from '../../routes/loaders';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';

export default function Sidebar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const { isDark, setMode } = useTheme();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const unread = useUnreadNotifications();

  // Binary quick toggle: light ⇄ dark. The full Light/Dark/System control
  // lives in Settings; the sidebar only flips between the two palettes.
  const nextMode = isDark ? 'light' : 'dark';

  // Collapsed (icon-only) state, remembered across sessions.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('performa_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('performa_sidebar_collapsed', String(next));
    } catch {}
  };

  const role = user?.role;
  const sections = sidebarSections(role);
  const homePath =
    role === 'admin'
      ? '/admin/users'
      : role === 'probationary_employee'
      ? '/employee/dashboard'
      : role === 'supervisor'
      ? '/supervisor/dashboard'
      : '/dashboard';

  return (
    <aside
      className={`hidden lg:flex flex-col h-full shrink-0 bg-glass backdrop-blur-md border-r border-line z-20 transition-[width,padding,gap] duration-performa ease-spring ${
        collapsed ? 'w-side-collapsed p-2 gap-3' : 'w-side p-3 gap-2'
      }`}
      aria-label="Main Navigation"
    >
      {/* Brand Header + collapse toggle */}
      <div className={`flex items-center ${collapsed ? 'flex-col gap-3 px-0 pt-1 pb-0' : 'gap-2 px-1 pt-1 pb-2'}`}>
        <Link
          to={homePath}
          className="flex items-center gap-2.5 min-w-0 group"
          title="Performa Home"
        >
          <div className={`${collapsed ? 'w-8 h-8' : 'w-8 h-8'} rounded-nav bg-accent text-accent-foreground flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ease-spring`}>
            <PerformaMark className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-16 leading-none tracking-tight text-ink block">
                Performa
              </span>
              <span className="text-12 text-ink-3 font-num block mt-0.5 truncate">
                {user?.organization_name || user?.organization_id}
              </span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={toggleCollapsed}
          className={`shrink-0 rounded-ctl border border-line bg-surface/50 text-ink-3 hover:text-ink hover:bg-hover flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            collapsed ? 'w-8 h-8' : 'w-7 h-7 ml-auto'
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Quick Search trigger */}
      {collapsed ? (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-8 h-8 mx-auto shrink-0 rounded-ctl border border-line bg-surface/60 hover:bg-hover text-ink-3 hover:text-ink flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title={`Search / command (${modifierKey()}+K)`}
          aria-label="Search / command"
        >
          <Search className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 h-9 mb-2 px-2.5 rounded-ctl border border-line bg-surface/60 hover:bg-hover text-ink-3 hover:text-ink text-14 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Search / command…</span>
          <kbd className="ml-auto font-num text-12 px-1 py-0.5 rounded border border-line shrink-0">
            {modifierKey()} K
          </kbd>
        </button>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <nav aria-label="Primary" className="flex flex-col">
          {sections.map((section, index) => {
            const groupClass =
              index === 0
                ? ''
                : section.divider
                ? collapsed
                  ? 'mt-2'
                  : 'mt-4'
                : collapsed
                ? 'mt-1'
                : 'mt-3';
            return (
              <div key={section.label || `group-${index}`} className={groupClass}>
                {!collapsed && section.label ? (
                  <div className="px-2.5 pb-1 text-12 font-medium text-ink-3">{section.label}</div>
                ) : null}
                <div className={`flex flex-col ${collapsed ? 'gap-1' : 'gap-0.5'}`}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isNotifications = item.path === '/notifications';
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        title={collapsed ? item.label : undefined}
                        onMouseEnter={() => prefetchRoute(item.path)}
                        onFocus={() => prefetchRoute(item.path)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-ctl text-14 transition-colors ${
                            collapsed ? 'justify-center px-0 h-10' : 'px-2.5 h-10'
                          } ${
                            isActive
                              ? 'bg-accent/10 text-ink font-semibold'
                              : 'text-ink-2 hover:bg-hover hover:text-ink'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span className="relative shrink-0">
                              <Icon
                                className={`w-[18px] h-[18px] ${
                                  isActive ? 'text-ink' : 'text-ink-3'
                                }`}
                              />
                              {isNotifications && collapsed && unread > 0 ? (
                                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />
                              ) : null}
                            </span>
                            {!collapsed && (
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            )}
                            {!collapsed && isNotifications && unread > 0 ? (
                              <span className="ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-12 font-num font-semibold text-accent-foreground">
                                <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
                                <span className="sr-only">{unread} unread</span>
                              </span>
                            ) : null}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div
        className={`flex items-center border-t border-line ${
          collapsed ? 'flex-col gap-3 px-0 pt-2' : 'gap-3 px-2.5 pt-3'
        }`}
      >
        <div
          className="w-8 h-8 rounded-full bg-accent/15 border border-accent/20 text-accent font-semibold text-12 flex items-center justify-center shrink-0"
          title={`${user?.full_name} (${user?.email})`}
        >
          {getInitials(user?.full_name)}
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-14 text-ink truncate leading-tight">
              {user?.full_name || 'User'}
            </div>
            <div className="text-12 text-ink-3 truncate capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMode(nextMode)}
          className="inline-flex w-8 h-8 items-center justify-center text-ink-3 hover:text-ink rounded-ctl hover:bg-hover transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title={`Switch to ${nextMode} theme`}
          aria-label={`Switch to ${nextMode} theme`}
        >
          {nextMode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setIsSignOutOpen(true)}
          className="inline-flex w-8 h-8 items-center justify-center text-ink-3 hover:text-bad rounded-ctl hover:bg-bad/10 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <ConfirmDialog
        isOpen={isSignOutOpen}
        onClose={() => setIsSignOutOpen(false)}
        onConfirm={logout}
        title="Sign out?"
        confirmLabel="Sign out"
        variant="danger"
      >
        <p>You will be signed out of Performa and returned to the login screen.</p>
      </ConfirmDialog>
    </aside>
  );
}
