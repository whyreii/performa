import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, ChevronLeft, Search, LogOut, Sun, Moon, Monitor } from '../icons';
import { getInitials } from '../../utils/format';

const MODES = ['light', 'dark', 'system'];
const MODE_ICON = { light: Sun, dark: Moon, system: Monitor };

export default function MobileBar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isSubPage =
    location.pathname.startsWith('/employees/') ||
    location.pathname.includes('/rate') ||
    location.pathname.includes('/rubrics');

  const ModeIcon = MODE_ICON[mode] || Monitor;
  const nextMode = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);

  return (
    <header className="lg:hidden sticky top-0 z-30 h-14 w-full bg-side/90 backdrop-blur-md border-b border-line px-4 flex items-center justify-between">
      {/* Left side: Back button or Brand */}
      {isSubPage ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-accent font-semibold text-14 py-1 -ml-1 active:scale-95 transition-transform ease-spring"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-nav bg-accent text-accent-foreground flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-16 tracking-tight text-ink">Performa</span>
        </div>
      )}

      {/* Right side: Search, Theme Toggle, Avatar, Logout */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-8 h-8 rounded-ctl border border-line bg-surface/80 text-ink-3 hover:text-ink flex items-center justify-center transition-colors"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Color mode cycle */}
        <button
          type="button"
          onClick={nextMode}
          className="h-8 px-2.5 rounded-ctl border border-line bg-surface/80 text-ink-2 text-12 capitalize flex items-center gap-1.5 active:scale-95 transition-all"
          title={`Color mode: ${mode} (tap to change)`}
          aria-label={`Color mode: ${mode}. Tap to change.`}
        >
          <ModeIcon className="w-3.5 h-3.5" />
          <span className="text-12">{mode}</span>
        </button>

        {/* User initials */}
        <div
          className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 text-accent font-semibold text-12 flex items-center justify-center"
          title={`${user?.full_name} (${user?.role})`}
        >
          {getInitials(user?.full_name)}
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-8 h-8 text-ink-3 hover:text-bad rounded-ctl flex items-center justify-center transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
