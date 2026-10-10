import { describe, it, expect } from 'vitest';
import { PROBATION_DAYS, TARGET, MILESTONES, COMPETENCIES } from './domain';

describe('domain constants', () => {
  it('mirrors the statutory Article 296 values', () => {
    expect(PROBATION_DAYS).toBe(180);
    expect(TARGET).toBe(4.0);
    expect(MILESTONES).toEqual([150, 165, 178]);
  });

  it('defines exactly the five competencies', () => {
    expect(COMPETENCIES).toHaveLength(5);
    for (const competency of COMPETENCIES) {
      expect(competency).toHaveProperty('key');
      expect(competency).toHaveProperty('label');
    }
  });
});
