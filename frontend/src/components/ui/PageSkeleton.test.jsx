import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PageSkeleton from './PageSkeleton';

describe('PageSkeleton', () => {
  it('renders a fully decorative loading frame', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
