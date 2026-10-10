// OS detection for keyboard-shortcut labels only — never for behavior. The app
// accepts both Ctrl and ⌘ (AppShell listens for either).
export function isMac() {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  return /mac/i.test(platform) || /mac os x/i.test(navigator.userAgent || '');
}

// The modifier key to show on shortcut hints: ⌘ on macOS, Ctrl elsewhere.
export function modifierKey() {
  return isMac() ? '⌘' : 'Ctrl';
}
