import { MAX_HINTS } from '@/engine/shuffle';

import { ExampleTile } from '../help/ExampleTile';
import { Modal } from '../ui/Modal';
import { SHUFFLE_HELP_EXAMPLE } from './helpExample';

export interface ShuffleHelpModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function Word({ word, state }: { word: string; state: 'filled' | 'correct' }): React.JSX.Element {
  return (
    <span className="flex gap-1">
      {[...word].map((letter, index) => (
        <ExampleTile key={index} letter={letter} state={state} />
      ))}
    </span>
  );
}

/**
 * Explains WordShuffle to a player who has not seen it (FR-147, US-38). Opened
 * only from the header control, never by the app itself (ADR-020), so it needs
 * no persisted state.
 */
export function ShuffleHelpModal({ isOpen, onClose }: ShuffleHelpModalProps): React.JSX.Element {
  const { scramble, target, other } = SHUFFLE_HELP_EXAMPLE;

  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          The letters of a hidden word arrive shuffled in the{' '}
          <strong className="font-bold">tray</strong>. Put them in order to spell a real word. Type
          the letters, or tap them in the tray. Backspace puts the last letter back.
        </p>
        <p>
          <strong className="font-bold">Any real word</strong> that uses exactly those letters wins,
          not only the one the puzzle was drawn from.
        </p>
        <p>
          <strong className="font-bold">Reshuffle</strong> mixes up the letters left in the tray, as
          often as you like. <strong className="font-bold">Hint</strong> locks the next letter of
          the hidden word in its place. You can take {MAX_HINTS} hints. A locked letter cannot be
          moved.
        </p>
        <p>
          A clock counts up from your first letter. It never ends the puzzle, and there is no limit
          on tries. It keeps running if you leave and come back.{' '}
          <strong className="font-bold">Give up</strong> shows the word and every other word with
          the same letters.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentences below carry the meaning (A11Y-13). */}
          <div aria-hidden="true" className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.65rem] font-bold tracking-wide text-text-muted uppercase">
                Tray
              </span>
              <Word word={scramble} state="filled" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.65rem] font-bold tracking-wide text-text-muted uppercase">
                One hint taken
              </span>
              <span className="flex gap-1">
                <ExampleTile letter={target.charAt(0)} state="correct" />
                {[...target.slice(1)].map((_, index) => (
                  <ExampleTile key={index} letter="" state="empty" />
                ))}
              </span>
            </div>
          </div>
          <p className="mt-2">
            The tray holds <strong className="font-bold">{[...scramble].join(' ')}</strong>. The
            hidden word is <strong className="font-bold">{target}</strong>, and so is{' '}
            <strong className="font-bold">{other}</strong>: either one wins. A hint would lock{' '}
            <strong className="font-bold">{target.charAt(0)}</strong> in the first place, and then
            only words starting with {target.charAt(0)} still fit.
          </p>
        </section>
      </div>
    </Modal>
  );
}
