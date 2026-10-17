import type { WordLength } from '@/engine';
import { SHUFFLE_LENGTHS } from '@/engine/shuffle';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';
import { formatDuration } from '@/lib/format';

import { ChangeLength } from '../game/ChangeLength';
import { Button } from '../ui/Button';

export interface ShuffleResultPanelProps {
  readonly solved: boolean;
  readonly length: WordLength;
  /** The word that solved it, or the drawn target after a give up. */
  readonly word: string;
  readonly hintsUsed: number;
  /** How long the puzzle took, in ms, or absent when the clock never started (ADR-038). */
  readonly elapsedMs?: number | null;
  /** The other valid anagrams, not including `word` (FR-145). */
  readonly others: readonly string[];
  readonly onPlayAgain: () => void;
  readonly onChangeLength: (length: WordLength) => void;
}

/**
 * Shown when the puzzle ends (FR-145): solved or given up, the word found, hints
 * used, the other valid anagrams, **Play again** and **Change length**.
 *
 * It mounts only once the puzzle is over, so the Enter that submitted the
 * solving answer cannot also start the next one (FR-73, AC-55).
 */
export function ShuffleResultPanel({
  solved,
  length,
  word,
  hintsUsed,
  elapsedMs = null,
  others,
  onPlayAgain,
  onChangeLength,
}: ShuffleResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="shuffle-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="shuffle-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {solved ? 'Solved!' : 'Gave up'}
      </h2>

      <div>
        <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">
          {solved ? 'Your word' : 'The word'}
        </h3>
        <p className="font-mono text-xl font-bold tracking-widest">{word}</p>
      </div>

      {elapsedMs === null || elapsedMs <= 0 ? null : (
        <p className="text-sm text-text-muted">Time {formatDuration(elapsedMs)}</p>
      )}

      <p className="text-sm text-text-muted">
        {hintsUsed === 0
          ? 'No hints used'
          : `${String(hintsUsed)} ${hintsUsed === 1 ? 'hint' : 'hints'} used`}
      </p>

      {others.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">
            Other words with these letters
          </h3>
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-sm font-bold tracking-wider">
            {others.map((other) => (
              <li key={other}>{other}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-text-muted">No other word uses these letters.</p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain}>Play again</Button>
        <ChangeLength lengths={SHUFFLE_LENGTHS} current={length} onChange={onChangeLength} />
      </div>
    </section>
  );
}
