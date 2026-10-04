import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, ChevronLeft, Search, LogOut } from '../icons';
import { getInitials } from '../../utils/format';
import { PALETTE_IDS, PALETTE_BG } from '../../config/themes';

export default function MobileBar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const { palette, setPalette } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isSubPage =
    location.pathname.startsWith('/employees/') ||
    location.pathname.includes('/rate') ||
    location.pathname.includes('/rubrics');

  const palettes = PALETTE_IDS;
  const nextPalette = () => {
    const idx = palettes.indexOf(palette);
    setPalette(palettes[(idx + 1) % palettes.length]);
  };

  return (
    <header className="lg:hidden sticky top-0 z-30 h-14 w-full bg-side/90 backdrop-blur-md border-b border-line px-4 flex items-center justify-between">
      {/* Left side: Back button or Brand */}
      {isSubPage ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-accent font-semibold text-sm py-1 -ml-1 active:scale-95 transition-transform ease-spring"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-nav bg-accent text-accent-foreground flex items-center justify-center shadow-sm">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-base tracking-tight text-ink">Performa</span>
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

        {/* Quick theme cycle pill */}
        <button
          type="button"
          onClick={nextPalette}
          className="h-8 px-2.5 rounded-ctl border border-line bg-surface/80 text-ink-2 text-xs font-mono capitalize flex items-center gap-1.5 active:scale-95 transition-all"
          title={`Current theme: ${palette} (Tap to cycle)`}
        >
          <span
            className="w-3 h-3 rounded-full border border-line"
            style={{ backgroundColor: PALETTE_BG[palette] }}
          />
          <span className="text-12">{palette}</span>
        </button>

        {/* User initials */}
        <div
          className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 text-accent font-semibold text-xs flex items-center justify-center"
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
