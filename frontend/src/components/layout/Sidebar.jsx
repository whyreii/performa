import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BarChart3, LogOut, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { sidebarNav } from '../../config/nav';
import { getInitials } from '../../utils/format';

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
  const navItems = sidebarNav(role);

  // Live Philippine Standard Time (Asia/Manila)
  const [manilaTime, setManilaTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setManilaTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className={`hidden md:flex flex-col sticky top-0 h-screen bg-side border-r border-line shadow-side z-20 transition-all duration-performa ${
        collapsed ? 'w-[72px] px-2.5 py-3.5' : 'w-[250px] p-4'
      }`}
      aria-label="Main Navigation"
    >
      {/* Brand Header */}
      <div className={`flex items-center ${collapsed ? 'flex-col gap-2.5 mb-3' : 'justify-between mb-3 h-10'}`}>
        <div
          onClick={() => {
            if (role === 'admin') navigate('/admin/users');
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

      {/* Manila Time Clock (Article 296 Timezone Anchor) */}
      {!collapsed && manilaTime && (
        <div className="mb-3 px-2.5 py-1.5 rounded-ctl bg-hover/50 border border-line/60 flex items-center justify-between text-[11px] font-mono text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-good animate-pulse" />
            <span>Manila (UTC+8)</span>
          </span>
          <span className="text-ink font-semibold">{manilaTime}</span>
        </div>
      )}

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
                {user?.role?.replace(/_/g, ' ')}
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
