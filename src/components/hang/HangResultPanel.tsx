import type { WordLength } from '@/engine';
import { HANG_LENGTHS, MAX_MISSES } from '@/engine/hang';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';
import { formatDuration } from '@/lib/format';

import { ChangeLength } from '../game/ChangeLength';
import { Button } from '../ui/Button';

export interface HangResultPanelProps {
  readonly won: boolean;
  readonly length: WordLength;
  readonly secret: string;
  readonly misses: number;
  /** How long the game took, in ms, or absent when the clock never started. */
  readonly elapsedMs?: number | null;
  readonly onPlayAgain: () => void;
  readonly onChangeLength: (length: WordLength) => void;
}

/**
 * Shown when the game ends (FR-172): won or lost, the word, the misses, the
 * time, **Play again** (same length) and **Change length**.
 *
 * It mounts only once the game is over, so the key that ended it cannot also
 * start the next game. That key is a letter, never Enter, and the panel is not
 * on screen until after it (FR-73, AC-55).
 */
export function HangResultPanel({
  won,
  length,
  secret,
  misses,
  elapsedMs = null,
  onPlayAgain,
  onChangeLength,
}: HangResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  const missText = misses === 0 ? 'No misses' : `${String(misses)} of ${String(MAX_MISSES)} misses`;

  return (
    <section
      aria-labelledby="hang-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="hang-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {won ? 'You saved them!' : 'Out of misses'}
      </h2>

      <p className="text-sm text-text-muted">
        {missText}
        {elapsedMs === null || elapsedMs <= 0 || !won ? '' : ` · ${formatDuration(elapsedMs)}`}
      </p>

      <div>
        <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">The word</h3>
        <p className="font-mono text-xl font-bold tracking-widest">{secret}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain}>Play again</Button>
        <ChangeLength lengths={HANG_LENGTHS} current={length} onChange={onChangeLength} />
      </div>
    </section>
  );
}
