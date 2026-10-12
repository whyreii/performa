import { describe, it, expect } from 'vitest';
import { railGeometry } from './MilestoneRail';

describe('railGeometry', () => {
  it('runs the full 0–180 term before Day 150', () => {
    const g = railGeometry(30);
    expect(g.zoom).toBe(false);
    expect(g.fill).toBeCloseTo(16.7, 1);
    expect(g.ticks[0]).toBeCloseTo(83.3, 1);
    expect(g.ticks[1]).toBeCloseTo(91.7, 1);
    expect(g.ticks[2]).toBeCloseTo(98.9, 1);
  });

  it('zooms into the 150–180 decision window from Day 150', () => {
    const g = railGeometry(152);
    expect(g.zoom).toBe(true);
    expect(g.fill).toBeCloseTo(6.7, 1);
    expect(g.ticks[0]).toBe(0);
    expect(g.ticks[1]).toBeCloseTo(50, 1);
    expect(g.ticks[2]).toBeCloseTo(93.3, 1);
  });

  it('caps the fill at the 180-day term', () => {
    expect(railGeometry(200).fill).toBe(100);
  });
});
