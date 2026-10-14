import type { WordLength } from '@/engine';
import { CODE_MAX_GUESSES } from '@/engine/code';

import { ExampleTile } from '../help/ExampleTile';
import { Modal } from '../ui/Modal';
import { codeHelpExample } from './helpExample';
import { countLabel } from './noteLabel';

export interface CodeHelpModalProps {
  readonly isOpen: boolean;
  readonly length: WordLength;
  readonly onClose: () => void;
}

/**
 * Explains WordCode to a player who knows Wordle but not Bulls and Cows
 * (FR-136, US-38). The two-guess example follows the selected length. Opened
 * only from the header control, never by the app itself (ADR-020), so it needs
 * no persisted state.
 */
export function CodeHelpModal({ isOpen, length, onClose }: CodeHelpModalProps): React.JSX.Element {
  const example = codeHelpExample(length);

  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          Find the hidden {length}-letter word in {CODE_MAX_GUESSES} guesses. There are no coloured
          tiles. After each guess you get two numbers.
        </p>
        <p>
          A <strong className="font-bold">bull</strong> is a letter in the right place. A{' '}
          <strong className="font-bold">cow</strong> is a letter that is in the word but in the
          wrong place.
        </p>
        <p>
          Repeated letters count once for each copy in the hidden word. If the word has one E, a
          guess with three E&rsquo;s can score one bull or one cow for E, never more.
        </p>
        <p>
          <strong className="font-bold">Letter notes</strong> are yours to keep. Switch the keyboard
          to <strong className="font-bold">Mark</strong>, press a letter to mark it ruled out, press
          again to mark it in the word, and press a third time to clear it. Switch back to{' '}
          <strong className="font-bold">Type</strong> to enter guesses. The game never changes your
          notes.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentences below carry the meaning (A11Y-13). */}
          <ol aria-hidden="true" className="flex flex-col gap-1">
            {example.guesses.map((guess) => (
              <li key={guess.word} className="flex items-center justify-between gap-2">
                <span className="flex gap-1">
                  {[...guess.word].map((letter, index) => (
                    <ExampleTile key={index} letter={letter} state="filled" />
                  ))}
                </span>
                <span className="text-xs whitespace-nowrap">
                  {countLabel(guess.bulls, 'bull', 'bulls')} ·{' '}
                  {countLabel(guess.cows, 'cow', 'cows')}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2">
            The hidden word is <strong className="font-bold">{example.secret}</strong>.
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {example.guesses.map((guess) => (
              <li key={guess.word}>
                <strong className="font-bold">{guess.word}</strong>:{' '}
                {countLabel(guess.bulls, 'bull', 'bulls')} and{' '}
                {countLabel(guess.cows, 'cow', 'cows')}.
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
