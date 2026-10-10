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

  it('renders the auto-regularization warning past the cap', () => {
    expect(text(<MilestonePill daysElapsed={181} />)).toContain('Passed 180-Day Cap');
  });

  it('renders each statutory milestone window', () => {
    expect(text(<MilestonePill daysElapsed={150} />)).toContain('Review Due');
    expect(text(<MilestonePill daysElapsed={165} />)).toContain('Notice Window');
    expect(text(<MilestonePill daysElapsed={178} />)).toContain('Critical Action');
  });

  it('renders a plain day counter before any milestone', () => {
    expect(text(<MilestonePill daysElapsed={10} />)).toContain('Day 10');
  });
});
