// Shared display helpers.

export function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}
