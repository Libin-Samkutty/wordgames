import { useState } from 'react';

import { Button } from '../ui/Button';

export interface ChangeLengthProps<L extends number | string> {
  /** Every length (or mode) the game offers. */
  readonly lengths: readonly L[];
  readonly current: L;
  readonly onChange: (length: L) => void;
  /** The button that reveals the choices. Defaults to "Change length". */
  readonly buttonLabel?: string;
  /** The choices' group name, for assistive tech. Defaults to "New game length". */
  readonly groupLabel?: string;
  /** The text of one choice. Defaults to "5 letters". */
  readonly optionLabel?: (value: L) => string;
}

/**
 * **Change length** on a result panel (FR-21, FR-91): one press reveals the
 * other lengths, and choosing one starts a fresh game at it. There is nothing
 * to confirm, because the game is over.
 */
export function ChangeLength<L extends number | string>({
  lengths,
  current,
  onChange,
  buttonLabel = 'Change length',
  groupLabel = 'New game length',
  optionLabel = (value) => `${String(value)} letters`,
}: ChangeLengthProps<L>): React.JSX.Element {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        aria-expanded={isOpen}
        onClick={() => {
          setOpen((open) => !open);
        }}
      >
        {buttonLabel}
      </Button>

      {isOpen ? (
        <div role="group" aria-label={groupLabel} className="flex w-full justify-center gap-2">
          {lengths
            .filter((length) => length !== current)
            .map((length) => (
              <Button
                key={length}
                variant="secondary"
                onClick={() => {
                  onChange(length);
                }}
              >
                {optionLabel(length)}
              </Button>
            ))}
        </div>
      ) : null}
    </>
  );
}
