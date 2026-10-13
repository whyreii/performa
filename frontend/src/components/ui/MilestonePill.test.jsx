import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MilestonePill from './MilestonePill';

const text = (ui) => {
  const { container } = render(ui);
  return container.textContent;
};

describe('MilestonePill', () => {
  it('renders terminal statuses', () => {
    expect(text(<MilestonePill status="regularized" />)).toContain('Regularized');
    expect(text(<MilestonePill status="terminated" />)).toContain('Terminated');
  });

  it('renders constructive regularization past the cap', () => {
    expect(text(<MilestonePill daysElapsed={181} />)).toContain(
      'Past Day 180 · constructive regularization'
    );
  });

  it('renders each review milestone stage', () => {
    expect(text(<MilestonePill daysElapsed={150} />)).toContain('Day 150 · Performance appraisal');
    expect(text(<MilestonePill daysElapsed={165} />)).toContain('Day 165 · Milestone review');
    expect(text(<MilestonePill daysElapsed={178} />)).toContain('Day 178 · Final milestone');
  });

  it('renders the probation day before any milestone', () => {
    expect(text(<MilestonePill daysElapsed={10} />)).toContain('Day 10 of 180');
  });
});
