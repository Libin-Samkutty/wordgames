import { useEffect, useRef } from 'react';

/**
 * Elements that already do something on Enter, which must keep doing it
 * (FR-72). A disabled control does nothing, so it does not count: the
 * on-screen key that was last clicked is disabled once the game is over, and
 * it must not swallow the player's Enter.
 */
const ENTER_HANDLING = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled)',
  'textarea:not(:disabled)',
  'select:not(:disabled)',
  'summary',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="link"]',
  '[role="radio"]:not([aria-disabled="true"])',
  '[role="switch"]',
].join(', ');

function isDialogOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

function targetHandlesEnter(event: KeyboardEvent): boolean {
  const target = event.target instanceof Element ? event.target : document.activeElement;
  return target instanceof Element && target.closest(ENTER_HANDLING) !== null;
}

/**
 * Pressing physical Enter on a result panel starts the next game, the same as
 * activating **Play again** (FR-72, ADR-027, US-24).
 *
 * Called by each game's result panel, so the listener exists only while that
 * panel is mounted. The Enter that submitted the final guess happened before
 * the panel mounted, so it can never also start a new game (FR-73). Beyond
 * that it ignores:
 *   - `event.repeat`, so a held Enter does not chain into a new game (EC-35);
 *   - any modifier key;
 *   - an open dialog, which owns the key (EC-36);
 *   - focus on a button, link or text field, which keep their own Enter
 *     behaviour, so nothing fires twice.
 *
 * It never moves focus (A11Y-18). `usePhysicalKeyboard` is untouched: it stays
 * detached once the game is over.
 */
export function useEnterToContinue(onContinue: () => void): void {
  // Latest callback without re-attaching the listener on every render.
  const latest = useRef(onContinue);
  useEffect(() => {
    latest.current = onContinue;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter') return;
      if (event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isDialogOpen()) return;
      if (targetHandlesEnter(event)) return;

      event.preventDefault();
      latest.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
