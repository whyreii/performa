import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreLedger from './ScoreLedger';

const COMPETENCIES = [
  { key: 'task_completion', label: 'Task Completion', score: 4.5, target: 4.0 },
  { key: 'quality_of_work', label: 'Quality of Work', score: 2.1, target: 4.0 },
];

describe('ScoreLedger', () => {
  it('renders one accessible meter per competency with its value', () => {
    render(<ScoreLedger competencies={COMPETENCIES} />);
    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(2);
    expect(meters[0]).toHaveAttribute('aria-valuenow', '4.5');
    expect(meters[1]).toHaveAttribute('aria-valuenow', '2.1');
    expect(meters[0]).toHaveAttribute('aria-valuemin', '0');
    expect(meters[0]).toHaveAttribute('aria-valuemax', '5');
    expect(meters[0]).toHaveAttribute('aria-label', 'Task Completion score');
  });

  it('tones the numeral by score against the target', () => {
    render(<ScoreLedger competencies={COMPETENCIES} />);
    expect(screen.getByText('4.5').className).toContain('text-good');
    expect(screen.getByText('2.1').className).toContain('text-bad');
  });

  it('shows the target notch and the competency descriptions', () => {
    render(<ScoreLedger competencies={COMPETENCIES} />);
    expect(screen.getAllByTitle('Target: 4.0')).toHaveLength(2);
    expect(screen.getByText(/Deliverables completed on schedule/)).toBeInTheDocument();
  });

  it('renders nothing extra for an empty competency list', () => {
    const { container } = render(<ScoreLedger competencies={[]} />);
    expect(container.querySelectorAll('.sc-ledger__row')).toHaveLength(0);
  });
});
