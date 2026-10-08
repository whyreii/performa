import React from 'react';
import Modal from './Modal';
import Button from './Button';

// Confirmation prompt for consequential actions (sign-offs, status changes,
// password resets). Renders a standard modal with a Cancel + Confirm pair; the
// confirm button takes a Button `variant` (use "danger" for destructive acts).
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="confirm-dialog-title" maxWidth="max-w-md">
      <h2 id="confirm-dialog-title" className="text-16 font-semibold text-ink">
        {title}
      </h2>
      {children && (
        <div className="mt-2 text-14 text-ink-2 leading-relaxed space-y-3">{children}</div>
      )}
      <div className="mt-5 pt-4 border-t border-line flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={variant} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
