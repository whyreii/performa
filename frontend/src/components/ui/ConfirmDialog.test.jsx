import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';
import { axeViolations } from '../../test/axe';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog isOpen={false} onClose={() => {}} onConfirm={() => {}} title="Sure?" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title, message and labelled buttons when open', () => {
    render(
      <ConfirmDialog
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
        title="Deactivate account?"
        confirmLabel="Deactivate"
      >
        <p>This blocks sign-in.</p>
      </ConfirmDialog>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Deactivate account?')).toBeInTheDocument();
    expect(screen.getByText('This blocks sign-in.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog isOpen onClose={() => {}} onConfirm={onConfirm} title="Proceed?" confirmLabel="Proceed" />
    );
    screen.getByRole('button', { name: 'Proceed' }).click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog isOpen onClose={onClose} onConfirm={() => {}} title="Proceed?" />);
    screen.getByRole('button', { name: 'Cancel' }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no detectable accessibility violations when open', async () => {
    const { baseElement } = render(
      <ConfirmDialog isOpen onClose={() => {}} onConfirm={() => {}} title="Deactivate account?">
        <p>This blocks sign-in.</p>
      </ConfirmDialog>
    );
    expect(await axeViolations(baseElement)).toEqual([]);
  });
});
