import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useEnterToContinue } from './useEnterToContinue';

/**
 * Enter to continue (T-56: FR-72, FR-73, A11Y-18, EC-35, EC-36, AC-28).
 */

function Panel({ onContinue }: { onContinue: () => void }): React.JSX.Element {
  useEnterToContinue(onContinue);

  return (
    <section>
      <button type="button" onClick={onContinue}>
        Play again
      </button>
      <a href="#/">All games</a>
      <input aria-label="Name" />
      <button type="button" disabled>
        Disabled key
      </button>
    </section>
  );
}

function pressEnter(init: KeyboardEventInit = {}): boolean {
  return fireEvent.keyDown(document.body, { key: 'Enter', ...init });
}

describe('useEnterToContinue', () => {
  it('continues on a plain Enter and prevents its default (FR-72)', () => {
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);

    const notPrevented = pressEnter();

    expect(onContinue).toHaveBeenCalledOnce();
    expect(notPrevented).toBe(false);
  });

  it('ignores other keys', () => {
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);

    fireEvent.keyDown(document.body, { key: ' ' });
    fireEvent.keyDown(document.body, { key: 'a' });
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('ignores key repeats, so a held Enter cannot chain (EC-35)', () => {
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);

    pressEnter({ repeat: true });

    expect(onContinue).not.toHaveBeenCalled();
  });

  it.each([['ctrlKey'], ['metaKey'], ['altKey'], ['shiftKey']])(
    'ignores Enter with %s held',
    (modifier) => {
      const onContinue = vi.fn();
      render(<Panel onContinue={onContinue} />);

      pressEnter({ [modifier]: true });

      expect(onContinue).not.toHaveBeenCalled();
    },
  );

  it('ignores Enter while a dialog is open (EC-36)', () => {
    const onContinue = vi.fn();
    render(
      <>
        <Panel onContinue={onContinue} />
        <div role="dialog" aria-modal="true" aria-label="Statistics" />
      </>,
    );

    pressEnter();

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('ignores Enter while a confirmation dialog is open (EC-36)', () => {
    const onContinue = vi.fn();
    render(
      <>
        <Panel onContinue={onContinue} />
        <div role="alertdialog" aria-modal="true" aria-label="Confirm" />
      </>,
    );

    pressEnter();

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('ignores Enter on a focused button, whose own Enter still works once (FR-72)', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);

    screen.getByRole('button', { name: 'Play again' }).focus();
    await user.keyboard('{Enter}');

    // Once from the button's click, not twice with the hook.
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('ignores Enter on a focused link', () => {
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);

    fireEvent.keyDown(screen.getByRole('link', { name: 'All games' }), { key: 'Enter' });

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('ignores Enter in a text field', () => {
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Enter' });

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('does not let a disabled control swallow Enter', () => {
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Disabled key' }), { key: 'Enter' });

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('never moves focus (A11Y-18)', () => {
    const onContinue = vi.fn();
    render(<Panel onContinue={onContinue} />);
    const before = document.activeElement;

    pressEnter();

    expect(document.activeElement).toBe(before);
    expect(document.activeElement).toBe(document.body);
  });

  it('stops listening once the panel unmounts (FR-73)', () => {
    const onContinue = vi.fn();
    const { unmount } = render(<Panel onContinue={onContinue} />);

    unmount();
    pressEnter();

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('does not react to the Enter that mounted the panel (FR-73)', () => {
    const onContinue = vi.fn();

    // Mirrors a game: a window listener ends the game on Enter, then the
    // result panel mounts and arms its own listener.
    function Game(): React.JSX.Element {
      const [over, setOver] = useState(false);

      useEffect(() => {
        if (over) return;
        const end = (event: KeyboardEvent): void => {
          if (event.key === 'Enter') setOver(true);
        };
        window.addEventListener('keydown', end);
        return () => {
          window.removeEventListener('keydown', end);
        };
      }, [over]);

      return over ? <Panel onContinue={onContinue} /> : <p>playing</p>;
    }

    render(<Game />);

    pressEnter();

    // The panel is now mounted, but the keypress that mounted it is spent.
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();

    pressEnter();
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('calls the latest callback without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Panel onContinue={first} />);

    rerender(<Panel onContinue={second} />);
    pressEnter();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
