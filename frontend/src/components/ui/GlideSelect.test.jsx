import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlideSelect from './GlideSelect';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('GlideSelect', () => {
  it('renders the selected label and exposes the given id on the combobox', () => {
    render(
      <GlideSelect id="pick" ariaLabel="Pick" value="b" onChange={() => {}} options={OPTIONS} />
    );
    const trigger = screen.getByRole('combobox', { name: 'Pick' });
    expect(trigger).toHaveAttribute('id', 'pick');
    expect(trigger).toHaveTextContent('Beta');
  });

  it('opens on keyboard and calls onChange when an option is picked', () => {
    const onChange = vi.fn();
    render(<GlideSelect ariaLabel="Pick" value="a" onChange={onChange} options={OPTIONS} />);
    const trigger = screen.getByRole('combobox');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // open
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // move to Beta
    fireEvent.keyDown(trigger, { key: 'Enter' }); // pick

    expect(onChange).toHaveBeenCalledWith('b', expect.objectContaining({ value: 'b' }));
  });
});
