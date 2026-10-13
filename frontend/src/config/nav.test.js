import { describe, it, expect } from 'vitest';
import { sidebarNav, tabNav, commandNav } from './nav';

describe('role navigation', () => {
  it('resolves sidebar entries to routes with icons', () => {
    const items = sidebarNav('admin');
    expect(items.some((i) => i.path === '/admin/users')).toBe(true);
    expect(items[0]).toHaveProperty('icon');
    expect(items[0]).toHaveProperty('label');
  });

  it('returns mobile tab and command entries per role', () => {
    expect(tabNav('employer').length).toBeGreaterThan(0);
    expect(commandNav('admin').length).toBeGreaterThan(0);
  });

  it('returns an empty list for an unknown role', () => {
    expect(sidebarNav('nope')).toEqual([]);
  });
});
