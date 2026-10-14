import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    isOpen: true,
    title: 'Delete things?',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ConfirmDialog {...props}>This removes the things.</ConfirmDialog>) };
}

describe('ConfirmDialog (FR-34, FR-47)', () => {
  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('is a labelled alert dialog that shows its message', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Delete things?' });
    expect(dialog).toHaveTextContent('This removes the things.');
  });

  it('calls onConfirm from the confirm button only', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('treats the Cancel button, Escape and the close button as cancel', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(props.onCancel).toHaveBeenCalledTimes(3);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('uses a custom cancel label', () => {
    renderDialog({ cancelLabel: 'Keep playing' });

    expect(screen.getByRole('button', { name: 'Keep playing' })).toBeInTheDocument();
  });
});
