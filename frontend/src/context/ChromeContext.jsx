import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// The iMac shell keeps the page title + actions in the top toolbar and a
// left/right note in the bottom status bar. Pages push into it (via <Page>'s
// title/subtitle/actions and useStatusBar()); AppShell's Toolbar and StatusBar
// read it. Actions are portalled into a slot element the Toolbar registers, so
// pages keep passing JSX to <Page actions={…}> unchanged.
const ChromeContext = createContext(null);

export function ChromeProvider({ children }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [statusLeft, setStatusLeft] = useState('');
  const [statusRight, setStatusRight] = useState('');
  const [actionsEl, setActionsEl] = useState(null);

  const value = useMemo(
    () => ({
      title,
      setTitle,
      subtitle,
      setSubtitle,
      statusLeft,
      setStatusLeft,
      statusRight,
      setStatusRight,
      actionsEl,
      setActionsEl,
    }),
    [title, subtitle, statusLeft, statusRight, actionsEl]
  );

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

const noop = () => {};

// Pages are also rendered in isolation (unit tests) without the shell; fall back
// to a no-op chrome so <Page> stays usable outside <ChromeProvider>.
const FALLBACK = {
  title: '',
  subtitle: '',
  statusLeft: '',
  statusRight: '',
  actionsEl: null,
  setTitle: noop,
  setSubtitle: noop,
  setStatusLeft: noop,
  setStatusRight: noop,
  setActionsEl: noop,
};

export function useChrome() {
  return useContext(ChromeContext) || FALLBACK;
}

// Push the current page's left/right status-bar facts. Cleared on unmount.
export function useStatusBar(left, right) {
  const { setStatusLeft, setStatusRight } = useChrome();
  useEffect(() => {
    setStatusLeft(left || '');
    setStatusRight(right || '');
    return () => {
      setStatusLeft('');
      setStatusRight('');
    };
  }, [left, right, setStatusLeft, setStatusRight]);
}
