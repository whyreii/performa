import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusDot from './StatusDot';

describe('StatusDot', () => {
  it('renders the label and a pulsing dot for critical status', () => {
    const { container } = render(<StatusDot status="critical" label="Critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(container.querySelector('.animate-ping')).toBeTruthy();
  });

  it('renders a static dot for a healthy status', () => {
    const { container } = render(<StatusDot status="active" />);
    expect(container.querySelector('.animate-ping')).toBeNull();
    expect(container.querySelector('.bg-ok')).toBeTruthy();
  });

  it('falls back gracefully for an unknown status', () => {
    render(<StatusDot status="something-else" />);
    expect(document.querySelector('.inline-flex')).toBeTruthy();
  });
});
