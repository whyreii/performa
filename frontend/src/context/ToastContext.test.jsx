import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';

function Probe() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.success('Saved successfully')}>
      fire
    </button>
  );
}

describe('ToastContext', () => {
  it('renders a live-region status toast and dismisses it', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('fire'));

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Saved successfully');

    fireEvent.click(screen.getByRole('button', { name: 'Close notification' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
