import React, { createContext, useContext, useMemo, useState } from 'react';

// The iMac shell keeps the page title + actions in the top toolbar. Pages push
// into it (via <Page>'s title/actions); AppShell's Toolbar reads it. Actions are
// portalled into a slot element the Toolbar registers, so pages keep passing JSX
// to <Page actions={…}> unchanged.
const ChromeContext = createContext(null);

export function ChromeProvider({ children }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [actionsEl, setActionsEl] = useState(null);

  const value = useMemo(
    () => ({
      title,
      setTitle,
      subtitle,
      setSubtitle,
      actionsEl,
      setActionsEl,
    }),
    [title, subtitle, actionsEl]
  );

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

const noop = () => {};

// Pages are also rendered in isolation (unit tests) without the shell; fall back
// to a no-op chrome so <Page> stays usable outside <ChromeProvider>.
const FALLBACK = {
  title: '',
  subtitle: '',
  actionsEl: null,
  setTitle: noop,
  setSubtitle: noop,
  setActionsEl: noop,
};

export function useChrome() {
  return useContext(ChromeContext) || FALLBACK;
}
