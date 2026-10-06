import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MilestoneComposition from './MilestoneComposition';

describe('MilestoneComposition', () => {
  it('exposes the breakdown as one accessible summary', () => {
    render(<MilestoneComposition total={4} onTrack={1} review={1} notice={1} critical={1} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '4 active probationers: 1 on track, 1 review due, 1 notice window, 1 critical.'
    );
  });

  it('renders a labelled legend for all four statuses', () => {
    render(<MilestoneComposition total={4} onTrack={1} review={1} notice={1} critical={1} />);
    ['On track', 'Review', 'Notice', 'Critical'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('draws a bar segment only for non-zero statuses', () => {
    const { container } = render(
      <MilestoneComposition total={2} onTrack={2} review={0} notice={0} critical={0} />
    );
    const segments = [...container.querySelectorAll('[data-segment]')].map((el) =>
      el.getAttribute('data-segment')
    );
    expect(segments).toEqual(['onTrack']);
  });

  it('renders an optional action slot', () => {
    render(
      <MilestoneComposition total={1} onTrack={0} review={1} notice={0} critical={0} action={<button>Review</button>} />
    );
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
  });

  it('renders nothing when there are no probationers', () => {
    const { container } = render(<MilestoneComposition total={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
