import { WORD_LENGTHS, type WordLength } from '@/engine';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';
import { formatDuration, formatNumber } from '@/lib/format';

import { Button } from '../ui/Button';
import { ChangeLength } from './ChangeLength';

export interface ResultPanelProps {
  readonly won: boolean;
  readonly answer: string;
  readonly guessesUsed: number;
  readonly solveMs: number;
  readonly score: number;
  readonly wordLength: WordLength;
  readonly onPlayAgain: () => void;
  readonly onChangeLength: (length: WordLength) => void;
}

/**
 * Shown after the final reveal completes (FR-21, FR-33, A11Y-5).
 *
 * On a loss the answer is spelled out, so the game always resolves rather than
 * leaving the player guessing.
 */
export function ResultPanel({
  won,
  answer,
  guessesUsed,
  solveMs,
  score,
  wordLength,
  onPlayAgain,
  onChangeLength,
}: ResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="result-heading"
      className="flex animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-6 py-4 text-center"
    >
      <h2 id="result-heading" className="text-lg font-bold tracking-wide uppercase">
        {won ? 'You won!' : 'Out of guesses'}
      </h2>

      {won ? (
        <p className="text-sm text-text-muted">
          Solved in {guessesUsed} {guessesUsed === 1 ? 'guess' : 'guesses'}
        </p>
      ) : (
        <p className="text-sm text-text-muted">
          The word was{' '}
          <strong className="font-bold tracking-widest text-text uppercase">{answer}</strong>
        </p>
      )}

      <dl className="flex gap-6 text-sm">
        <div>
          <dt className="text-xs tracking-wide text-text-muted uppercase">Time</dt>
          <dd className="font-bold tabular-nums">{formatDuration(solveMs)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-text-muted uppercase">Score</dt>
          <dd className="font-bold tabular-nums">{formatNumber(score)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain}>Play again</Button>
        <ChangeLength lengths={WORD_LENGTHS} current={wordLength} onChange={onChangeLength} />
      </div>
    </section>
  );
}
