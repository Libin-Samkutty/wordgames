import type { WordLength } from '@/engine';
import { describeEvaluation } from '@/lib/format';

import { ExampleTile } from '../help/ExampleTile';
import { Modal } from '../ui/Modal';
import { dodgeHelpExample } from './helpExample';

export interface DodgeHelpModalProps {
  readonly isOpen: boolean;
  readonly length: WordLength;
  readonly onClose: () => void;
}

/**
 * Explains WordDodge to a player who knows Wordle (FR-156, US-39). The example
 * follows the selected length. Opened only from the header control, never by
 * the app itself (ADR-020), so it needs no persisted state.
 */
export function DodgeHelpModal({
  isOpen,
  length,
  onClose,
}: DodgeHelpModalProps): React.JSX.Element {
  const example = dodgeHelpExample(length);

  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          Find the hidden {length}-letter word, but there is a catch: the game has not picked one.
          Each time you guess, it looks at every word that could still be the answer and gives you
          the colours that leave it the <strong className="font-bold">most</strong> words to choose
          from. It never commits until only one is left.
        </p>
        <p>
          The colours work as in Wordle. Green is the right letter in the right place, yellow is in
          the word but in the wrong place, and grey is not in the word.
        </p>
        <p>
          The count above the board shows how many words are still possible. Your job is to make it
          fall to one, and then guess that word. There is no guess limit, so aim for as few as you
          can. A guess that tells you little is a wasted turn.
        </p>
        <p>
          <strong className="font-bold">Give up</strong> shows one of the words that was still
          possible. It counts in your statistics and ends your streak.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentence below carries the meaning (A11Y-13). */}
          <div aria-hidden="true" className="flex gap-1">
            {[...example.word].map((letter, index) => (
              <ExampleTile
                key={index}
                letter={letter}
                state={example.evaluation[index] ?? 'absent'}
              />
            ))}
          </div>
          <p className="mt-2">
            <strong className="font-bold">{example.word}</strong>:{' '}
            {describeEvaluation(example.word, example.evaluation)}. Words like{' '}
            <strong className="font-bold">{example.candidate}</strong> would score this way.
          </p>
        </section>
      </div>
    </Modal>
  );
}
