import { describe, it, expect, vi } from 'vitest';
import { renderHook, fireEvent } from '@testing-library/react';
import { useEscapeKey } from './useEscapeKey';

describe('useEscapeKey', () => {
  it('calls the handler on Escape while active', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, true));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handler).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does nothing while inactive', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, false));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();
  });
});
