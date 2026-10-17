import { useEnterToContinue } from '@/hooks/useEnterToContinue';
import { formatDuration } from '@/lib/format';

import { Button } from '../ui/Button';

export interface HuntResultPanelProps {
  readonly completed: boolean;
  readonly foundCount: number;
  readonly requiredCount: number;
  readonly bonusCount: number;
  /** How long the puzzle took, in ms, or absent when the clock never started. */
  readonly elapsedMs?: number | null;
  /** The words not found, shown after a give up (FR-163). */
  readonly missed: readonly string[];
  readonly onPlayAgain: () => void;
}

/**
 * Shown when the puzzle ends (FR-163): every word found or gave up, how many
 * words were found, bonus words, the time, the words missed, and **Play again**.
 *
 * It mounts only once the puzzle is over, so the Enter that submitted the last
 * word cannot also start the next puzzle (FR-73, AC-55).
 */
export function HuntResultPanel({
  completed,
  foundCount,
  requiredCount,
  bonusCount,
  elapsedMs = null,
  missed,
  onPlayAgain,
}: HuntResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="hunt-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="hunt-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {completed ? 'Every word found!' : 'Gave up'}
      </h2>

      <p className="text-sm text-text-muted">
        {String(foundCount)} of {String(requiredCount)} words
        {elapsedMs === null || elapsedMs <= 0 ? '' : ` · ${formatDuration(elapsedMs)}`}
      </p>

      {bonusCount > 0 ? (
        <p className="text-sm text-text-muted">
          {String(bonusCount)} bonus {bonusCount === 1 ? 'word' : 'words'}
        </p>
      ) : null}

      {missed.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">Words you missed</h3>
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-sm font-bold tracking-wider">
            {missed.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button onClick={onPlayAgain}>Play again</Button>
    </section>
  );
}
