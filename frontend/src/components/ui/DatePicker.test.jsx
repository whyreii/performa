import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePicker from './DatePicker';

describe('DatePicker', () => {
  it('shows a placeholder when empty and the formatted date when set', () => {
    const { rerender } = render(<DatePicker id="d" label="Start date" value="" onChange={() => {}} />);
    expect(screen.getByText('Select a date')).toBeInTheDocument();

    rerender(<DatePicker id="d" label="Start date" value="2026-10-15" onChange={() => {}} />);
    expect(screen.getByText('Oct 15, 2026')).toBeInTheDocument();
  });

  it('opens a calendar and returns the picked day as YYYY-MM-DD', () => {
    const onChange = vi.fn();
    render(<DatePicker id="d" label="Start date" value="2026-10-15" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose date' }));
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'October 22, 2026' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-22');
    // Selecting closes the popover.
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).not.toBeInTheDocument();
  });

  it('clears the value', () => {
    const onChange = vi.fn();
    render(<DatePicker id="d" label="Start date" value="2026-10-15" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
