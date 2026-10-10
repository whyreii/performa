import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Tabs from './Tabs';
import { axeViolations } from '../../test/axe';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
];

describe('Tabs', () => {
  it('exposes a labelled radiogroup with the selected option checked', () => {
    render(<Tabs ariaLabel="Filter by role" value="a" onChange={() => {}} tabs={TABS} />);
    expect(screen.getByRole('radiogroup', { name: 'Filter by role' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'false');
  });

  it('moves selection with ArrowRight and keeps a single tab stop', () => {
    const onChange = vi.fn();
    render(<Tabs ariaLabel="Filter" value="all" onChange={onChange} tabs={TABS} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'All' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('jumps to the last option on End', () => {
    const onChange = vi.fn();
    render(<Tabs ariaLabel="Filter" value="all" onChange={onChange} tabs={TABS} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'All' }), { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <Tabs ariaLabel="Filter by role" value="a" onChange={() => {}} tabs={TABS} />
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
