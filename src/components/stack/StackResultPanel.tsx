import { STACK_MODE_IDS, type StackMode } from '@/engine/stack';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';

import { ChangeLength } from '../game/ChangeLength';
import { Button } from '../ui/Button';

export interface StackResultPanelProps {
  readonly won: boolean;
  readonly mode: StackMode;
  readonly guessesUsed: number;
  readonly maxGuesses: number;
  readonly boardsSolved: number;
  /** Each board's answer, with whether it was solved. */
  readonly answers: readonly { readonly word: string; readonly solved: boolean }[];
  readonly onPlayAgain: () => void;
  readonly onChangeMode: (mode: StackMode) => void;
}

const MODE_LABEL: Record<StackMode, string> = { duo: 'Duo', quad: 'Quad' };

/**
 * Shown when the game ends (FR-110): won or lost, guesses used out of the
 * limit, boards solved, every answer, **Play again** (same mode) and
 * **Change mode**.
 *
 * It mounts only after the final reveal, so the Enter that submitted the last
 * guess cannot also start the next game (FR-73, AC-55).
 */
export function StackResultPanel({
  won,
  mode,
  guessesUsed,
  maxGuesses,
  boardsSolved,
  answers,
  onPlayAgain,
  onChangeMode,
}: StackResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="stack-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="stack-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {won ? 'You won!' : 'Out of guesses'}
      </h2>

      <p className="text-sm text-text-muted">
        {String(guessesUsed)} of {String(maxGuesses)} guesses · {String(boardsSolved)} of{' '}
        {String(answers.length)} boards solved
      </p>

      <div>
        <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">The words</h3>
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-sm font-bold tracking-wider">
          {answers.map(({ word, solved }) => (
            <li key={word}>
              {word}
              <span className="sr-only">{solved ? ' (solved)' : ' (not solved)'}</span>
              {solved ? (
                <span aria-hidden="true" className="ml-0.5 text-text-muted">
                  ✓
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain}>Play again</Button>
        <ChangeLength
          lengths={STACK_MODE_IDS}
          current={mode}
          onChange={onChangeMode}
          buttonLabel="Change mode"
          groupLabel="New game mode"
          optionLabel={(value) => MODE_LABEL[value]}
        />
      </div>
    </section>
  );
}
