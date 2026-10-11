import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  PALETTE_MODES,
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  isValidPalette,
} from '../config/themes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Default surface is graphite (dark, black/white); paper is the opt-in light
  // theme. Light/Dark/System remain selectable in Settings — "System" follows the OS.
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem('performa-theme-pref') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [palette, setPaletteState] = useState(() => {
    try {
      const saved = localStorage.getItem('performa-palette');
      if (saved && isValidPalette(saved)) {
        return saved;
      }
      const pref = localStorage.getItem('performa-theme-pref') || 'dark';
      if (pref === 'dark') return DEFAULT_DARK_PALETTE;
      if (pref === 'light') return DEFAULT_LIGHT_PALETTE;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE;
    } catch {
      return DEFAULT_DARK_PALETTE;
    }
  });

  // User preference that forces reduced motion app-wide, independent of the OS
  // setting. Applied as `data-reduce-motion` on <html> (see index.css) so CSS,
  // CountUp and RubberSegment all honour it.
  const [reduceMotion, setReduceMotionState] = useState(() => {
    try {
      return localStorage.getItem('performa-reduce-motion') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', palette);
    root.setAttribute('data-reduce-motion', reduceMotion ? 'true' : 'false');
    try {
      localStorage.setItem('performa-palette', palette);
      localStorage.setItem('performa-theme-pref', mode);
      localStorage.setItem('performa-reduce-motion', String(reduceMotion));
    } catch {}
  }, [palette, mode, reduceMotion]);

  const setReduceMotion = useCallback((value) => setReduceMotionState(Boolean(value)), []);

  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const targetPalette = e.matches ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE;
      setPaletteState(targetPalette);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode]);

  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    if (newMode === 'light') {
      const newPal = PALETTE_MODES[palette] === 'light' ? palette : DEFAULT_LIGHT_PALETTE;
      setPaletteState(newPal);
    } else if (newMode === 'dark') {
      const newPal = PALETTE_MODES[palette] === 'dark' ? palette : DEFAULT_DARK_PALETTE;
      setPaletteState(newPal);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setPaletteState(prefersDark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE);
    }
  }, [palette]);

  const setPalette = useCallback((newPalette) => {
    if (!isValidPalette(newPalette)) return;
    setPaletteState(newPalette);
    setModeState(PALETTE_MODES[newPalette]);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      palette,
      setMode,
      setPalette,
      reduceMotion,
      setReduceMotion,
      isDark: PALETTE_MODES[palette] === 'dark',
    }),
    [mode, palette, setMode, setPalette, reduceMotion, setReduceMotion]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
