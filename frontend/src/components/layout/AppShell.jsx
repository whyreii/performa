import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileBar from './MobileBar';
import BottomTabBar from './BottomTabBar';
import CommandPalette from './CommandPalette';
import ShortcutModal from './ShortcutModal';

export default function AppShell({ children }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);

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
      {/* Skip link — first focusable element (WCAG 2.4.1 Bypass Blocks) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-ctl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-pop"
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
        className="flex-1 min-w-0 overflow-y-auto [scrollbar-gutter:stable] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-20 lg:pb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        tabIndex={-1}
      >
        <div className="max-w-[1120px] mx-auto w-full">
          {children || <Outlet />}
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
