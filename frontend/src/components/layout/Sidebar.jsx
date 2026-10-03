import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  Users,
  LayoutDashboard,
  FileCheck2,
  History,
  Settings,
  Target,
  Award,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Bell,
  Activity,
} from 'lucide-react';

export default function Sidebar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Remember collapsed state in localStorage
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

  // Role-specific navigation items
  const getNavItems = () => {
    if (role === 'admin') {
      return [
        { label: 'System Overview', path: '/admin/overview', icon: LayoutDashboard },
        { label: 'User Accounts', path: '/admin/users', icon: ShieldCheck },
        { label: 'Employee Records', path: '/employees', icon: Users },
        { label: 'Activity Log', path: '/admin/activity', icon: Activity },
        { label: 'Audit Trail', path: '/audits', icon: History },
        { label: 'Notifications', path: '/notifications', icon: Bell },
        { label: 'Settings', path: '/settings', icon: Settings },
      ];
    }
    if (role === 'employer') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Employees', path: '/employees', icon: Users },
        { label: 'Rollups & AI Plans', path: '/rollups', icon: FileCheck2 },
        { label: 'Audit Trail', path: '/audits', icon: History },
        { label: 'Notifications', path: '/notifications', icon: Bell },
        { label: 'Settings', path: '/settings', icon: Settings },
      ];
    }
    if (role === 'supervisor') {
      return [
        { label: 'Supervisor Dashboard', path: '/supervisor/dashboard', icon: LayoutDashboard },
        { label: 'Employees', path: '/employees', icon: Users },
        { label: 'Rate Employee', path: '/supervisor/rate', icon: Award },
        { label: 'KPI Rubrics', path: '/supervisor/rubrics', icon: Target },
        { label: 'Notifications', path: '/notifications', icon: Bell },
        { label: 'Settings', path: '/settings', icon: Settings },
      ];
    }
    // Probationary Employee
    return [
      { label: 'My Scorecard', path: '/employee/dashboard', icon: Award },
      { label: 'Training Plans', path: '/employee/training', icon: BookOpen },
      { label: 'Notifications', path: '/notifications', icon: Bell },
      { label: 'Settings', path: '/settings', icon: Settings },
    ];
  };

  const navItems = getNavItems();

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  return (
    <aside
      className={`hidden md:flex flex-col sticky top-0 h-screen bg-side border-r border-line shadow-side z-20 transition-all duration-performa ${
        collapsed ? 'w-[72px] px-2.5 py-3.5' : 'w-[250px] p-4'
      }`}
      aria-label="Main Navigation"
    >
      {/* Brand Header */}
      <div className={`flex items-center ${collapsed ? 'flex-col gap-2.5 mb-3' : 'justify-between mb-4 h-10'}`}>
        <div
          onClick={() => {
            if (role === 'admin') navigate('/admin/overview');
            else if (role === 'probationary_employee') navigate('/employee/dashboard');
            else if (role === 'supervisor') navigate('/supervisor/dashboard');
            else navigate('/dashboard');
          }}
          className={`flex items-center gap-3 cursor-pointer group min-w-0 ${collapsed ? 'justify-center' : ''}`}
          title="Performa Home"
        >
          <div className="w-8 h-8 rounded-nav bg-accent text-accent-foreground flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            <BarChart3 className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-base tracking-tight text-ink block leading-none">
                Performa
              </span>
              <span className="text-[11px] text-ink-3 tracking-normal font-mono block mt-0.5">
                Acme PH
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`${
            collapsed ? 'w-8 h-8' : 'w-7 h-7'
          } shrink-0 rounded-ctl border border-line bg-surface/50 text-ink-3 hover:text-ink hover:bg-hover flex items-center justify-center transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-accent`}
          title={collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Quick Search trigger */}
      {!collapsed ? (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full h-9 mb-4 px-2.5 rounded-ctl border border-line bg-surface/60 hover:bg-hover text-ink-3 hover:text-ink flex items-center justify-between text-xs transition-colors shadow-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search / Commands...</span>
          </div>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-line text-ink-3 bg-bg">
            Ctrl+K
          </kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-8 h-8 mx-auto mb-3 shrink-0 rounded-ctl border border-line bg-surface/50 hover:bg-hover text-ink-3 hover:text-ink flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          title="Command Palette (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </button>
      )}

      {/* Navigation Section */}
      <div className="flex-1 overflow-y-auto space-y-1 py-1">
        {!collapsed && (
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3 px-2 py-1.5">
            Navigation
          </div>
        )}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 h-10 rounded-nav text-sm font-medium transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-3'
                  } ${
                    isActive
                      ? 'text-accent bg-accent/12 font-semibold shadow-xs'
                      : 'text-ink-2 hover:bg-hover hover:text-ink'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Footer Card */}
      <div className="pt-3 mt-auto border-t border-line">
        <div className={`flex items-center gap-2.5 ${collapsed ? 'flex-col justify-center' : ''}`}>
          <div
            className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 text-accent font-semibold text-xs flex items-center justify-center shrink-0"
            title={`${user?.full_name} (${user?.email})`}
          >
            {getInitials(user?.full_name)}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs text-ink truncate leading-tight">
                {user?.full_name || 'User'}
              </div>
              <div className="text-[11px] text-ink-3 truncate capitalize">
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className="p-1.5 text-ink-3 hover:text-bad rounded-ctl hover:bg-bad/10 transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
