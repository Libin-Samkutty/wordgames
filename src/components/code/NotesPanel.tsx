import { memo } from 'react';

import type { NoteMark, Notes } from '@/engine/code';
import { ALPHABET } from '@/engine';
import { cn } from '@/lib/cn';

import { noteLabel } from './noteLabel';
import { noteStyle } from './noteStyle';

export interface NotesPanelProps {
  readonly notes: Notes;
  readonly disabled: boolean;
  readonly onCycle: (letter: string) => void;
}

const MARK_TEXT: Record<NoteMark, string> = { out: 'out', in: 'in' };

/**
 * The letter notes (FR-132): 26 buttons, one per letter, each cycling that
 * letter through unmarked, ruled out and in the word. They are the player's own
 * notes; no guess ever sets one.
 *
 * Each is a toggle whose name includes its current mark, such as `P, ruled out`
 * (A11Y-23). The mark is also written on the button and drawn as a strike or
 * an underline, so it never relies on colour. Each button is at least 44 px
 * square (FR-58).
 */
export const NotesPanel = memo(function NotesPanel({
  notes,
  disabled,
  onCycle,
}: NotesPanelProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="code-notes-heading"
      className="flex w-full flex-col gap-1.5 md:max-w-60"
    >
      <h2
        id="code-notes-heading"
        className="text-center text-[0.65rem] font-bold tracking-wide text-text-muted uppercase"
      >
        Letter notes
      </h2>
      <div
        className="grid justify-center gap-1"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2.75rem, 1fr))' }}
      >
        {[...ALPHABET].map((letter) => {
          const mark = notes[letter];

          return (
            <button
              key={letter}
              type="button"
              disabled={disabled}
              aria-label={noteLabel(letter, mark)}
              onClick={() => {
                onCycle(letter);
              }}
              className={cn(
                'flex min-h-11 min-w-11 flex-col items-center justify-center rounded text-sm leading-none font-bold select-none',
                'transition-colors duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
                noteStyle(mark),
              )}
            >
              <span aria-hidden="true">{letter}</span>
              <span aria-hidden="true" className="mt-0.5 h-2.5 text-[0.55rem] font-semibold">
                {mark ? MARK_TEXT[mark] : ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
