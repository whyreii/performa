import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TimelineDocket from './TimelineDocket';

describe('TimelineDocket', () => {
  it('renders every statutory milestone plus Today', () => {
    render(<TimelineDocket startDate="2026-01-01" day180Date="2026-06-30" daysElapsed={10} />);
    ['Start', 'Review', 'Notice', 'Critical', 'Deadline', 'Today'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('marks the reached milestone and the Today row', () => {
    const { container } = render(
      <TimelineDocket startDate="2026-01-01" day180Date="2026-06-30" daysElapsed={154} />
    );
    const reached = container.querySelector('.docket__row.is-reached .docket__n');
    const today = container.querySelector('.docket__row.is-today .docket__n');
    expect(reached).toHaveTextContent('Review');
    expect(today).toHaveTextContent('Today');
  });

  it('keeps the status tone on the reached label (regression: CSS must not neutralise it)', () => {
    const { container } = render(
      <TimelineDocket startDate="2026-01-01" day180Date="2026-06-30" daysElapsed={154} />
    );
    const reached = container.querySelector('.docket__row.is-reached .docket__n');
    expect(reached.className).toContain('text-warn');
  });

  it('never marks the Start row as reached, even late in the window', () => {
    const { container } = render(
      <TimelineDocket startDate="2026-01-01" day180Date="2026-06-30" daysElapsed={200} />
    );
    const start = container.querySelector('.docket__row:first-child');
    expect(start.querySelector('.docket__n')).toHaveTextContent('Start');
    expect(start.classList.contains('is-reached')).toBe(false);
    expect(container.querySelector('.docket__row.is-reached .docket__n')).toHaveTextContent('Deadline');
  });
});
