import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AsyncBoundary from './AsyncBoundary';
import { axeViolations } from '../../test/axe';

describe('AsyncBoundary', () => {
  it('shows a skeleton while loading', () => {
    const { container } = render(<AsyncBoundary isLoading>content</AsyncBoundary>);
    expect(container).not.toHaveTextContent('content');
  });

  it('shows an error message with a working Retry', () => {
    const onRetry = vi.fn();
    render(
      <AsyncBoundary isError error={{ message: 'network down' }} onRetry={onRetry}>
        content
      </AsyncBoundary>
    );
    expect(screen.getByText('network down')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the empty slot when empty', () => {
    render(
      <AsyncBoundary isEmpty empty={<p>nothing here</p>}>
        content
      </AsyncBoundary>
    );
    expect(screen.getByText('nothing here')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders children when settled', () => {
    render(<AsyncBoundary>content</AsyncBoundary>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('has no detectable accessibility violations in the error state', async () => {
    const { container } = render(
      <AsyncBoundary isError error={{ message: 'network down' }} onRetry={() => {}}>
        content
      </AsyncBoundary>
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
