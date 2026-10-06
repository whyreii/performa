import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, LogOut, Search, Sun, Moon, ChevronLeft, ChevronRight } from '../icons';
import { sidebarNav } from '../../config/nav';
import { getInitials } from '../../utils/format';
import { formatManilaClock } from '../../utils/datetime';
import { prefetchRoute } from '../../routes/loaders';

export default function Sidebar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const { isDark, setMode } = useTheme();

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
  const navItems = sidebarNav(role);
  const homePath =
    role === 'admin'
      ? '/admin/users'
      : role === 'probationary_employee'
      ? '/employee/dashboard'
      : role === 'supervisor'
      ? '/supervisor/dashboard'
      : '/dashboard';

  // Live Philippine Standard Time (Asia/Manila). Initialised synchronously so
  // the block is present on first paint (avoids a post-paint layout shift).
  const [manilaTime, setManilaTime] = useState(() => formatManilaClock());
  useEffect(() => {
    const interval = setInterval(() => setManilaTime(formatManilaClock()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className={`hidden lg:flex flex-col sticky top-0 h-screen shrink-0 gap-2 bg-side border-r border-line shadow-side z-20 transition-[width,padding] duration-performa ease-spring ${
        collapsed ? 'w-[72px] p-2' : 'w-[270px] p-3'
      }`}
      aria-label="Main Navigation"
    >
      {/* Brand Header + collapse toggle */}
      <div className={`flex items-center gap-2 px-1 pt-1 pb-2.5 ${collapsed ? 'flex-col' : ''}`}>
        <Link
          to={homePath}
          className="flex items-center gap-2.5 min-w-0 group"
          title="Performa Home"
        >
          <div className="w-[26px] h-[26px] rounded-nav bg-accent text-accent-foreground flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ease-spring">
            <BarChart3 className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-14 leading-none tracking-tight text-ink block">
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

      {/* Manila Time Clock (Article 296 Timezone Anchor) */}
      {!collapsed && (
        <div className="flex items-center gap-2 px-1 pb-2 text-12 font-num text-ink-3">
          <span className="w-1.5 h-1.5 rounded-full bg-good animate-pulse" />
          <span>Manila (UTC+8)</span>
          <span className="ml-auto text-ink font-semibold">{manilaTime}</span>
        </div>
      )}

      {/* Quick Search trigger */}
      {collapsed ? (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-8 h-8 mx-auto mb-1.5 shrink-0 rounded-ctl border border-line bg-surface/60 hover:bg-hover text-ink-3 hover:text-ink flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Search / command (Ctrl+K)"
          aria-label="Search / command"
        >
          <Search className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 h-8 mb-1.5 px-2.5 rounded-ctl border border-line bg-surface/60 hover:bg-hover text-ink-3 hover:text-ink text-12 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Search / command…</span>
          <kbd className="ml-auto font-num text-12 px-1 py-0.5 rounded border border-line shrink-0">
            Ctrl ⌘ K
          </kbd>
        </button>
      )}

      {/* Navigation Section */}
      <div className="flex-1 overflow-y-auto">
        {!collapsed && <div className="side__label">Navigation</div>}
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 h-9 rounded-ctl text-14 transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-2.5'
                  } ${
                    isActive
                      ? 'bg-hover text-ink font-semibold'
                      : 'text-ink-2 hover:bg-hover hover:text-ink'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 text-ink-3" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div
        className={`flex items-center gap-2.5 pt-2.5 border-t border-line ${
          collapsed ? 'flex-col px-0' : 'px-2'
        }`}
      >
        <div
          className="w-7 h-7 rounded-nav bg-accent text-accent-foreground font-semibold text-12 flex items-center justify-center shrink-0"
          title={`${user?.full_name} (${user?.email})`}
        >
          {getInitials(user?.full_name)}
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-12 text-ink truncate leading-tight">
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
          className="p-1.5 text-ink-3 hover:text-ink rounded-ctl hover:bg-hover transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title={`Switch to ${nextMode} theme`}
          aria-label={`Switch to ${nextMode} theme`}
        >
          {nextMode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={logout}
          className="p-1.5 text-ink-3 hover:text-bad rounded-ctl hover:bg-bad/10 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
