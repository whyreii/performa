import React, { useState, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sidebarNav } from '../../config/nav';
import { prefetchRoute } from '../../routes/loaders';
import Sidebar from './Sidebar';
import MobileBar from './MobileBar';
import BottomTabBar from './BottomTabBar';
import CommandPalette from './CommandPalette';
import ShortcutModal from './ShortcutModal';
import ScrollToTop from './ScrollToTop';
import PageSkeleton from '../ui/PageSkeleton';

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-bg text-ink transition-colors duration-performa selection:bg-accent/20 selection:text-accent">
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

      {/* Main Content Area */}
      <main
        id="main"
        className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-20 lg:pb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        tabIndex={-1}
      >
        <div className="max-w-[1120px] mx-auto w-full">
          <Suspense fallback={<PageSkeleton />}>
            {children || <Outlet />}
          </Suspense>
        </div>
      </main>

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
  );
}
