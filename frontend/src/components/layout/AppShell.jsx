import React, { useState, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sidebarNav } from '../../config/nav';
import { prefetchRoute } from '../../routes/loaders';
import { ChromeProvider, useChrome } from '../../context/ChromeContext';
import Sidebar from './Sidebar';
import MobileBar from './MobileBar';
import BottomTabBar from './BottomTabBar';
import CommandPalette from './CommandPalette';
import ShortcutModal from './ShortcutModal';
import ScrollToTop from './ScrollToTop';
import PageSkeleton from '../ui/PageSkeleton';

// The single "gallery wall": max-width + horizontal padding live here ONCE.
// Every toolbar, status bar and page column reads from this, so they all share
// one left edge (docs/LAYOUT_GRAMMAR.md; enforced by
// backend/tests/guardrails/test_page_wrapper.py). 1104 - 2×32 (lg:px-8) = 1040
// content, matching the iMac concept's wall.
const WALL = 'app-wall mx-auto w-full max-w-[1104px] px-4 sm:px-6 lg:px-8';

function Toolbar() {
  const { title, subtitle, setActionsEl } = useChrome();
  return (
    <header className="app-toolbar flex-none h-[46px] border-b border-line bg-glass backdrop-blur-md">
      <div className={`${WALL} flex h-full items-center gap-3`}>
        {title ? (
          <span className="truncate text-16 font-semibold tracking-tight text-ink">{title}</span>
        ) : null}
        {subtitle ? <span className="hidden truncate text-12 text-ink-3 sm:block">{subtitle}</span> : null}
        <div ref={setActionsEl} className="ml-auto flex flex-none items-center gap-2" />
      </div>
    </header>
  );
}

function StatusBar() {
  const { statusLeft, statusRight } = useChrome();
  const { user } = useAuth();
  const org = user?.organization_name || user?.organization_id || 'Performa';
  return (
    <footer className="app-statusbar hidden lg:flex flex-none h-[28px] border-t border-line bg-glass text-12 text-ink-3 backdrop-blur-md">
      <div className={`${WALL} flex h-full items-center justify-between gap-3`}>
        <span className="truncate">{statusLeft || org}</span>
        <span className="truncate">{statusRight || 'Asia/Manila'}</span>
      </div>
    </footer>
  );
}

export default function AppShell({ children }) {
  const { user } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);

  // Warm the current role's route chunks once the browser is idle, so the first
  // navigation to each page resolves instantly (complements the hover prefetch).
  useEffect(() => {
    if (!user?.role) return;
    const paths = sidebarNav(user.role).map((item) => item.path);
    const run = () => paths.forEach(prefetchRoute);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(run, 1000);
    return () => clearTimeout(timer);
  }, [user?.role]);

  // Global hotkeys: Ctrl+K and ?
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) &&
        !document.activeElement?.isContentEditable
      ) {
        e.preventDefault();
        setIsShortcutModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ChromeProvider>
      <div className="app-window relative min-h-screen bg-bg text-ink transition-colors duration-performa selection:bg-accent/20 selection:text-accent lg:flex lg:h-[calc(100vh-3rem)] lg:min-h-0 lg:m-6 lg:overflow-hidden lg:rounded-float lg:border lg:border-line lg:shadow-win">
        <ScrollToTop />

        {/* Skip link — first focusable element (WCAG 2.4.1 Bypass Blocks) */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-ctl focus:bg-surface focus:px-4 focus:py-2 focus:text-14 focus:font-medium focus:text-ink focus:shadow-pop"
        >
          Skip to content
        </a>

        {/* Desktop Persistent Sidebar (>= lg) */}
        <Sidebar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

        {/* Mobile & Tablet Top App Bar (< lg) */}
        <MobileBar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

        {/* Main column: toolbar · scrolling content · status bar */}
        <div className="lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col">
          <Toolbar />

          <main
            id="main"
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
            tabIndex={-1}
          >
            <div className={`${WALL} pt-6 pb-24 lg:py-6`}>
              <Suspense fallback={<PageSkeleton />}>{children || <Outlet />}</Suspense>
            </div>
          </main>

          <StatusBar />
        </div>

        {/* Mobile Bottom Tab Bar */}
        <BottomTabBar />

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />

        {/* Global Keyboard Shortcut Modal */}
        <ShortcutModal
          isOpen={isShortcutModalOpen}
          onClose={() => setIsShortcutModalOpen(false)}
        />
      </div>
    </ChromeProvider>
  );
}
