import type { WordLength } from '@/engine';
import { MAX_MISSES } from '@/engine/hang';

import { ExampleTile } from '../help/ExampleTile';
import { Modal } from '../ui/Modal';

export interface HangHelpModalProps {
  readonly isOpen: boolean;
  readonly length: WordLength;
  readonly onClose: () => void;
}

/** One example word and the letters guessed in it, for each length. Decorative (A11Y-13). */
const EXAMPLES: Readonly<Record<WordLength, { word: string; guessed: string }>> = {
  4: { word: 'LAMB', guessed: 'AB' },
  5: { word: 'PLANT', guessed: 'AT' },
  6: { word: 'PLANET', guessed: 'AET' },
};

/**
 * Explains WordHang (FR-175, US-41). The example follows the selected length.
 * Opened only from the header control, never by the app itself (ADR-020), so it
 * needs no persisted state.
 */
export function HangHelpModal({ isOpen, length, onClose }: HangHelpModalProps): React.JSX.Element {
  const { word, guessed } = EXAMPLES[length];
  const shown = [...word].map((letter) => (guessed.includes(letter) ? letter : null));

  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          Find the hidden {length}-letter word one letter at a time. Press a letter on the keyboard.
          If it is in the word, it shows in every place it appears. If it is not, it is a miss and
          one more part of the figure is drawn.
        </p>
        <p>
          You have {MAX_MISSES} misses: the head, the body, two arms and two legs. The sixth miss
          loses the game. Reveal every letter first and you win. A letter you have tried cannot be
          pressed again, and a repeat costs nothing.
        </p>
        <p>
          Your keys show which letters you have tried: a tick for a letter in the word, and a cross
          for one that is not.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentence below carries the meaning (A11Y-13). */}
          <div aria-hidden="true" className="flex gap-1">
            {shown.map((letter, index) => (
              <ExampleTile
                key={index}
                letter={letter ?? ''}
                state={letter === null ? 'empty' : 'correct'}
              />
            ))}
          </div>
          <p className="mt-2">
            After guessing <strong className="font-bold">{[...guessed].join(', ')}</strong> in{' '}
            <strong className="font-bold">{word}</strong>, the word shows as{' '}
            {shown.map((letter) => letter ?? 'blank').join(', ')}.
          </p>
        </section>
      </div>
    </Modal>
  );
}
