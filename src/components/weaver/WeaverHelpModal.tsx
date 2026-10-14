import { evaluateRung, type WeaverLength } from '@/engine/weaver';

import { ExampleTile } from '../help/ExampleTile';
import { Modal } from '../ui/Modal';
import { WEAVER_HELP_EXAMPLES } from './helpExamples';

function ExampleRow({ word, end }: { word: string; end: string }): React.JSX.Element {
  const states = evaluateRung(word, end);

  return (
    <div className="flex gap-1">
      {[...word].map((letter, index) => (
        <ExampleTile key={index} letter={letter} state={states[index] ?? 'absent'} />
      ))}
    </div>
  );
}

/** "A and R", "G, R and A": the letters of `rung` that already match `end`. */
function greenLetters(rung: string, end: string): string {
  const letters = [...rung].filter((letter, index) => letter === end[index]);
  if (letters.length <= 1) return letters.join('');
  return `${letters.slice(0, -1).join(', ')} and ${letters[letters.length - 1] ?? ''}`;
}

export interface WeaverHelpModalProps {
  readonly isOpen: boolean;
  readonly length: WeaverLength;
  readonly onClose: () => void;
}

/**
 * Explains WordWeaver to a player who has never seen a word ladder (FR-95,
 * US-31). Opened only from the header control, never by the app itself
 * (ADR-020), so it needs no persisted state.
 */
export function WeaverHelpModal({
  isOpen,
  length,
  onClose,
}: WeaverHelpModalProps): React.JSX.Element {
  const example = WEAVER_HELP_EXAMPLES[length];
  const lastRung = example.rungs[example.rungs.length - 1] ?? example.start;
  const rows = [example.start, ...example.rungs, example.end];

  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>Get from the start word to the end word, one letter at a time.</p>
        <p>
          Each rung changes exactly one letter of the word above it, and must be a real {length}{' '}
          letter word. You finish by typing the end word.
        </p>
        <p>
          A letter turns green when it already matches the end word in the same spot. Grey means it
          does not.
        </p>
        <p>
          Stuck? Press Backspace on an empty row, or tap Undo, to remove your last rung. Give up
          shows one shortest ladder.
        </p>
        <p>
          Par is the shortest ladder made of everyday words. Every rung you submit counts as a move,
          even one you undo. A rarer word can get you under par.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentence below carries the meaning (A11Y-13). */}
          <div aria-hidden="true" className="flex flex-col gap-1">
            {rows.map((word, index) => (
              <ExampleRow key={index} word={word} end={example.end} />
            ))}
          </div>
          <p className="mt-2">
            The ladder runs {example.start}, {example.rungs.join(', ')}, then {example.end}. In{' '}
            <strong className="font-bold">{lastRung}</strong>, {greenLetters(lastRung, example.end)}{' '}
            already match {example.end}, so they are green.
          </p>
        </section>
      </div>
    </Modal>
  );
}
