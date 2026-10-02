import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const PALETTE_MODES = {
  midnight: 'dark',
  dusk: 'dark',
  paper: 'light',
  mist: 'light',
  sage: 'light',
};

const DEFAULT_DARK_PALETTE = 'midnight';
const DEFAULT_LIGHT_PALETTE = 'paper';

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem('performa-theme-pref') || 'system';
    } catch {
      return 'system';
    }
  });

  const [palette, setPaletteState] = useState(() => {
    try {
      const saved = localStorage.getItem('performa-palette');
      if (saved && /^(midnight|dusk|paper|mist|sage)$/.test(saved)) {
        return saved;
      }
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE;
    } catch {
      return DEFAULT_LIGHT_PALETTE;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', palette);
    try {
      localStorage.setItem('performa-palette', palette);
      localStorage.setItem('performa-theme-pref', mode);
    } catch {}
  }, [palette, mode]);

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

  const setMode = (newMode) => {
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
  };

  const setPalette = (newPalette) => {
    if (!/^(midnight|dusk|paper|mist|sage)$/.test(newPalette)) return;
    setPaletteState(newPalette);
    setModeState(PALETTE_MODES[newPalette]);
  };

  return (
    <ThemeContext.Provider value={{ mode, palette, setMode, setPalette, isDark: PALETTE_MODES[palette] === 'dark' }}>
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
