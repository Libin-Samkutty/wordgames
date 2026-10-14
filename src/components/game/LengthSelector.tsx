import { useRef, type KeyboardEvent } from 'react';

import { WORD_LENGTHS, type WordLength } from '@/engine';
import { cn } from '@/lib/cn';

export interface LengthSelectorProps {
  readonly value: WordLength;
  /** The lengths on offer. Wordwright has 4, 5 and 6; WordWeaver has 4 and 5. */
  readonly lengths?: readonly WordLength[];
  readonly disabled: boolean;
  readonly onChange: (length: WordLength) => void;
}

/**
 * Word-length picker (FR-1).
 *
 * Implements the ARIA radiogroup pattern rather than just borrowing its roles:
 * arrow keys move between options and wrap, Home/End jump to the ends, and the
 * group is a single tab stop via a roving `tabIndex`. Declaring
 * `role="radiogroup"` without those behaviours would promise a screen-reader
 * user something the widget does not actually do.
 */
export function LengthSelector({
  value,
  lengths = WORD_LENGTHS,
  disabled,
  onChange,
}: LengthSelectorProps): React.JSX.Element {
  const groupRef = useRef<HTMLDivElement>(null);

  /** Moves selection and focus together, as the radiogroup pattern requires. */
  const move = (delta: number): void => {
    const index = lengths.indexOf(value);
    const next = lengths[(index + delta + lengths.length) % lengths.length];
    if (next === undefined || next === value) return;

    onChange(next);
    groupRef.current?.querySelector<HTMLElement>(`[data-length="${String(next)}"]`)?.focus();
  };

  const jumpTo = (length: WordLength | undefined): void => {
    if (length === undefined || length === value) return;
    onChange(length);
    groupRef.current?.querySelector<HTMLElement>(`[data-length="${String(length)}"]`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        jumpTo(lengths[0]);
        break;
      case 'End':
        event.preventDefault();
        jumpTo(lengths[lengths.length - 1]);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Word length"
      className="flex items-center gap-0.5 rounded-md bg-surface-sunken p-0.5"
    >
      {lengths.map((length) => {
        const isSelected = length === value;

        return (
          <button
            key={length}
            type="button"
            role="radio"
            aria-checked={isSelected}
            // Roving tabIndex: the group is one tab stop, and arrows move
            // within it.
            tabIndex={isSelected ? 0 : -1}
            data-length={length}
            disabled={disabled}
            // Handled per-radio, not on the group: with a roving tabIndex the
            // focused radio is always the event target, and a focusable
            // container would add a second tab stop.
            onKeyDown={handleKeyDown}
            onClick={() => {
              onChange(length);
            }}
            className={cn(
              'min-h-9 rounded px-2.5 text-sm font-bold transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isSelected ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            {length}
            <span className="sr-only"> letters</span>
          </button>
        );
      })}
    </div>
  );
}
