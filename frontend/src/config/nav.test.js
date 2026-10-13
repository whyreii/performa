import { describe, it, expect } from 'vitest';
import { sidebarNav, sidebarSections, tabNav, commandNav } from './nav';

describe('role navigation', () => {
  it('resolves sidebar entries to routes with icons', () => {
    const items = sidebarNav('admin');
    expect(items.some((i) => i.path === '/admin/users')).toBe(true);
    expect(items[0]).toHaveProperty('icon');
    expect(items[0]).toHaveProperty('label');
  });

  it('groups the sidebar into labelled sections with a utility divider', () => {
    const sections = sidebarSections('employer');
    expect(sections.map((s) => s.label)).toEqual(['Performance', 'Compliance', 'Account']);
    expect(sections.at(-1).divider).toBe(true);
    expect(sections.slice(0, -1).every((s) => !s.divider)).toBe(true);
    // Flattening sections reproduces the flat nav order used for prefetch.
    expect(sidebarNav('employer').map((i) => i.path)).toEqual(
      sections.flatMap((s) => s.items.map((i) => i.path))
    );
  });

  it('returns mobile tab and command entries per role', () => {
    expect(tabNav('employer').length).toBeGreaterThan(0);
    expect(commandNav('admin').length).toBeGreaterThan(0);
  });

  it('returns an empty list for an unknown role', () => {
    expect(sidebarNav('nope')).toEqual([]);
    expect(sidebarSections('nope')).toEqual([]);
  });
});
