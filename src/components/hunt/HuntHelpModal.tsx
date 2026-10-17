import { ExampleTile } from '../help/ExampleTile';
import { Modal } from '../ui/Modal';

export interface HuntHelpModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** The example tray, and a few of the words that hide in it. Decorative (A11Y-13). */
const EXAMPLE_TRAY = 'PLATES';
const EXAMPLE_WORDS = ['LEAP', 'STALE', 'PLATES'];

/**
 * Explains WordHunt to a player who knows Wordle (FR-166, US-40). Opened only
 * from the header control, never by the app itself (ADR-020), so it needs no
 * persisted state.
 */
export function HuntHelpModal({ isOpen, onClose }: HuntHelpModalProps): React.JSX.Element {
  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          Six letters sit in the tray. Find every word of 4, 5 or 6 letters that can be made from
          them. Each letter can be used as many times as it appears in the tray.
        </p>
        <p>
          The slots show how many words are hiding at each length. A word you find fills its slot.
          Type the letters or tap them, then press Submit or Enter.
        </p>
        <p>
          The slots hold common words. Any other real word you find is a{' '}
          <strong className="font-bold">bonus word</strong>. It does not fill a slot and you do not
          need it, but it counts in your statistics.
        </p>
        <p>
          <strong className="font-bold">Reshuffle</strong> reorders the tray and is free. A clock
          counts up from your first letter and never ends the puzzle. Find every word in the slots
          to finish, or press <strong className="font-bold">Give up</strong> to see the ones you
          missed. A give up counts in your statistics and ends your streak.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentence below carries the meaning (A11Y-13). */}
          <div aria-hidden="true" className="flex gap-1">
            {[...EXAMPLE_TRAY].map((letter, index) => (
              <ExampleTile key={index} letter={letter} state="filled" />
            ))}
          </div>
          <p className="mt-2">
            From <strong className="font-bold">{EXAMPLE_TRAY}</strong> you can make{' '}
            {EXAMPLE_WORDS.map((word, index) => (
              <span key={word}>
                <strong className="font-bold">{word}</strong>
                {index < EXAMPLE_WORDS.length - 1 ? ', ' : ''}
              </span>
            ))}{' '}
            and more.
          </p>
        </section>
      </div>
    </Modal>
  );
}
