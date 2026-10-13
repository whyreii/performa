import { describe, it, expect } from 'vitest';
import { sidebarNav, sidebarSections, tabNav, commandNav } from './nav';

describe('role navigation', () => {
  it('resolves sidebar entries to routes with icons', () => {
    const items = sidebarNav('admin');
    expect(items.some((i) => i.path === '/admin/users')).toBe(true);
    expect(items[0]).toHaveProperty('icon');
    expect(items[0]).toHaveProperty('label');
  });

  it('groups the employer sidebar into labelled sections', () => {
    const sections = sidebarSections('employer');
    expect(sections.map((s) => s.label)).toEqual(['Manage', 'Compliance', 'Account']);
    // Flattening reproduces the flat nav (same paths, same order).
    const flat = sections.flatMap((s) => s.items);
    expect(flat.map((i) => i.path)).toEqual(sidebarNav('employer').map((i) => i.path));
    // Compliance keeps the routes the mockup omitted.
    const compliance = sections.find((s) => s.label === 'Compliance');
    expect(compliance.items.map((i) => i.path)).toEqual(['/audits', '/notifications']);
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
