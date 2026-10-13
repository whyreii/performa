import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Label from './Label';

describe('Label', () => {
  it('renders a canonical field label wired to its control', () => {
    render(<Label htmlFor="email">Work email</Label>);
    const label = screen.getByText('Work email');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'email');
    expect(label.className).toContain('text-14');
    expect(label.className).toContain('font-medium');
    expect(label.className).toContain('mb-1');
  });

  it('omits the stacked margin when block={false}', () => {
    render(
      <Label htmlFor="password" block={false}>
        Password
      </Label>
    );
    expect(screen.getByText('Password').className).not.toContain('mb-1');
  });
});
