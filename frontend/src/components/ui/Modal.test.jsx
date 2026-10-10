import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';
import { axeViolations } from '../../test/axe';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} label="Closed">
        <p>hidden</p>
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a named dialog and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} label="Edit record">
        <button type="button">inner</button>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Edit record');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('has no detectable accessibility violations when open', async () => {
    const { baseElement } = render(
      <Modal isOpen onClose={() => {}} label="Edit record">
        <button type="button">inner</button>
      </Modal>
    );
    expect(await axeViolations(baseElement)).toEqual([]);
  });
});
