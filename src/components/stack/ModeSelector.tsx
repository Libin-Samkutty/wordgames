import { useRef, type KeyboardEvent } from 'react';

import { STACK_MODE_IDS, type StackMode } from '@/engine/stack';
import { cn } from '@/lib/cn';

const LABEL: Record<StackMode, string> = { duo: 'Duo', quad: 'Quad' };

export interface ModeSelectorProps {
  readonly value: StackMode;
  readonly disabled: boolean;
  readonly onChange: (mode: StackMode) => void;
}

/**
 * The Duo / Quad picker in the header (FR-101, FR-102).
 *
 * The ARIA radiogroup pattern, like the length selector: one tab stop with a
 * roving `tabIndex`, arrow keys move between options and wrap, Home and End
 * jump to the ends.
 */
export function ModeSelector({ value, disabled, onChange }: ModeSelectorProps): React.JSX.Element {
  const groupRef = useRef<HTMLDivElement>(null);

  const select = (mode: StackMode | undefined): void => {
    if (mode === undefined || mode === value) return;
    onChange(mode);
    groupRef.current?.querySelector<HTMLElement>(`[data-mode="${mode}"]`)?.focus();
  };

  const move = (delta: number): void => {
    const index = STACK_MODE_IDS.indexOf(value);
    select(STACK_MODE_IDS[(index + delta + STACK_MODE_IDS.length) % STACK_MODE_IDS.length]);
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
        select(STACK_MODE_IDS[0]);
        break;
      case 'End':
        event.preventDefault();
        select(STACK_MODE_IDS[STACK_MODE_IDS.length - 1]);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Mode"
      className="flex items-center gap-0.5 rounded-md bg-surface-sunken p-0.5"
    >
      {STACK_MODE_IDS.map((mode) => {
        const isSelected = mode === value;

        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-mode={mode}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onClick={() => {
              onChange(mode);
            }}
            className={cn(
              'min-h-9 rounded px-2.5 text-sm font-bold transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isSelected ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            {LABEL[mode]}
          </button>
        );
      })}
    </div>
  );
}
