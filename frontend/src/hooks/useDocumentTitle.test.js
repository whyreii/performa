import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle';
import { BRAND } from '../config/brand';

describe('useDocumentTitle', () => {
  it('sets "<title> · <brand>" and falls back to the brand alone', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Dashboard' },
    });
    expect(document.title).toBe(`Dashboard · ${BRAND.name}`);

    rerender({ title: null });
    expect(document.title).toBe(BRAND.name);
  });
});
