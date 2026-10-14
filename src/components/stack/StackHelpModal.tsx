import { evaluateGuess, type LetterState } from '@/engine';
import { STACK_MODES } from '@/engine/stack';
import { cn } from '@/lib/cn';

import { ExampleTile } from '../help/ExampleTile';
import { Modal } from '../ui/Modal';
import { STACK_HELP_EXAMPLE } from './helpExample';

/** Colours for the split-key illustration, from the keyboard's own tokens. */
const SEGMENT_CLASS: Record<LetterState, string> = {
  correct: 'bg-key-correct',
  present: 'bg-key-present',
  absent: 'bg-key-absent',
};

function ExampleBoard({ guess, answer }: { guess: string; answer: string }): React.JSX.Element {
  const states = evaluateGuess(guess, answer);

  return (
    <div className="flex gap-1">
      {[...guess].map((letter, index) => (
        <ExampleTile key={index} letter={letter} state={states[index] ?? 'absent'} />
      ))}
    </div>
  );
}

/** The first letter of `guess` in a given state on `answer`, with its place in the guess. */
function firstLetterIn(
  guess: string,
  answer: string,
  wanted: LetterState,
): { letter: string; index: number } | null {
  const index = evaluateGuess(guess, answer).findIndex((state) => state === wanted);
  return index === -1 ? null : { letter: guess.charAt(index), index };
}

export interface StackHelpModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Explains WordStack to a player who knows Wordle but not multi-board games
 * (FR-114, US-38). Opened only from the header control, never by the app
 * itself (ADR-020), so it needs no persisted state.
 */
export function StackHelpModal({ isOpen, onClose }: StackHelpModalProps): React.JSX.Element {
  const { guess, boards } = STACK_HELP_EXAMPLE;
  const [first, second] = boards as readonly [string, string];
  const correct = firstLetterIn(guess, first, 'correct');
  const present = firstLetterIn(guess, second, 'present');
  // The first letter of the guess, drawn as a split key: each half is one board.
  const keyLetter = correct?.letter ?? guess.charAt(0);
  const keyStates = boards.map((answer) => evaluateGuess(guess, answer)[guess.indexOf(keyLetter)]);

  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          Solve every board at once. Each guess is played on every board that is still open, and
          each board colours it by its own hidden word.
        </p>
        <p>
          <strong className="font-bold">Duo</strong> has {STACK_MODES.duo.boards} boards and{' '}
          {STACK_MODES.duo.maxGuesses} guesses. <strong className="font-bold">Quad</strong> has{' '}
          {STACK_MODES.quad.boards} boards and {STACK_MODES.quad.maxGuesses} guesses. Every word has
          5 letters.
        </p>
        <p>
          Green means the right spot, yellow means in the word but elsewhere, and grey means not in
          the word. A board you solve is frozen: later guesses skip it.
        </p>
        <p>
          Each key on the keyboard is split, one part per board: the left half is board 1 and the
          right half is board 2. In Quad the parts are the four corners.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentences below carry the meaning (A11Y-13). */}
          <div aria-hidden="true" className="flex flex-col gap-2">
            {boards.map((answer, index) => (
              <div key={answer} className="flex flex-col gap-0.5">
                <span className="text-[0.65rem] font-bold tracking-wide text-text-muted uppercase">
                  Board {index + 1}
                </span>
                <ExampleBoard guess={guess} answer={answer} />
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2">
              <span className="relative flex h-10 w-12 overflow-hidden rounded">
                {keyStates.map((state, index) => (
                  <span
                    key={index}
                    className={cn('h-full flex-1', state ? SEGMENT_CLASS[state] : 'bg-key')}
                  />
                ))}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-sm bg-surface px-1 text-sm font-bold text-text">
                    {keyLetter}
                  </span>
                </span>
              </span>
              <span className="text-[0.65rem] font-bold tracking-wide text-text-muted uppercase">
                Split key
              </span>
            </div>
          </div>
          <p className="mt-2">
            You guess <strong className="font-bold">{guess}</strong> on two boards.
            {correct ? (
              <>
                {' '}
                On board 1, <strong className="font-bold">{correct.letter}</strong> is green.
              </>
            ) : null}
            {present ? (
              <>
                {' '}
                On board 2, <strong className="font-bold">{present.letter}</strong> is yellow.
              </>
            ) : null}{' '}
            The key for <strong className="font-bold">{keyLetter}</strong> shows both at once, one
            half each.
          </p>
        </section>
      </div>
    </Modal>
  );
}
