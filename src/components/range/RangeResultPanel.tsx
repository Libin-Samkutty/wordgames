import { RANGE_MAX_GUESSES } from '@/engine/range';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';

import { Button } from '../ui/Button';

export interface RangeResultPanelProps {
  readonly won: boolean;
  readonly guessesUsed: number;
  readonly secret: string;
  readonly onPlayAgain: () => void;
}

/**
 * Shown when the game ends (FR-123): won or lost, guesses used, the secret and
 * **Play again**.
 *
 * It mounts only once the game is over, so the Enter that submitted the last
 * guess cannot also start the next game (FR-73, AC-55).
 */
export function RangeResultPanel({
  won,
  guessesUsed,
  secret,
  onPlayAgain,
}: RangeResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="range-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="range-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {won ? 'You found it!' : 'Out of guesses'}
      </h2>

      <p className="text-sm text-text-muted">
        {String(guessesUsed)} of {String(RANGE_MAX_GUESSES)} guesses
      </p>

      <div>
        <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">The word</h3>
        <p className="font-mono text-xl font-bold tracking-widest">{secret}</p>
      </div>

      <Button onClick={onPlayAgain}>Play again</Button>
    </section>
  );
}
