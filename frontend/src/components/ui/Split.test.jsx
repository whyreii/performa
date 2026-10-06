import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Split from './Split';

describe('Split', () => {
  it('renders the main and rail content', () => {
    render(<Split main={<div>MAIN</div>} aside={<div>RAIL</div>} />);
    expect(screen.getByText('MAIN')).toBeInTheDocument();
    expect(screen.getByText('RAIL')).toBeInTheDocument();
  });

  it('uses a 12-column grid with an 8/4 main/rail split', () => {
    const { container } = render(<Split main={<p>m</p>} aside={<p>a</p>} />);
    const grid = container.firstChild;
    expect(grid.className).toContain('lg:grid-cols-12');
    const [mainCol, railCol] = grid.children;
    expect(mainCol.className).toContain('lg:col-span-8');
    expect(railCol.className).toContain('lg:col-span-4');
  });

  it('makes the rail sticky by default, static when disabled', () => {
    const { container, rerender } = render(<Split main={<p>m</p>} aside={<p>a</p>} />);
    expect(container.firstChild.children[1].className).toContain('lg:sticky');
    rerender(<Split main={<p>m</p>} aside={<p>a</p>} sticky={false} />);
    expect(container.firstChild.children[1].className).not.toContain('lg:sticky');
  });

  it('does not use <aside> (the print stylesheet hides it)', () => {
    const { container } = render(<Split main={<p>m</p>} aside={<p>a</p>} />);
    expect(container.querySelector('aside')).toBeNull();
  });

  it('collapses to one column in print', () => {
    const { container } = render(<Split main={<p>m</p>} aside={<p>a</p>} />);
    expect(container.firstChild.className).toContain('print:block');
  });
});
