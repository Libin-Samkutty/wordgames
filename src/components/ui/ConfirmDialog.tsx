import type { ReactNode } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  /** Says exactly what will be lost or changed (FR-34, FR-47). */
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * The one confirmation dialog every game and the settings danger zone share
 * (T-52, ACCEPTANCE 14.22).
 *
 * Escape, the close button and a backdrop click all mean Cancel, so the safe
 * outcome is always the easy one.
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element | null {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel} role="alertdialog">
      <div className="flex flex-col gap-4">
        <div className="text-sm">{children}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
