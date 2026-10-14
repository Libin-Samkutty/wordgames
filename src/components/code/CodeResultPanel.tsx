import { CODE_LENGTHS, CODE_MAX_GUESSES } from '@/engine/code';
import type { WordLength } from '@/engine';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';

import { ChangeLength } from '../game/ChangeLength';
import { Button } from '../ui/Button';

export interface CodeResultPanelProps {
  readonly won: boolean;
  readonly length: WordLength;
  readonly guessesUsed: number;
  readonly secret: string;
  readonly onPlayAgain: () => void;
  readonly onChangeLength: (length: WordLength) => void;
}

/**
 * Shown when the game ends (FR-133): won or lost, guesses used, the secret,
 * **Play again** (same length) and **Change length**.
 *
 * It mounts only once the game is over, so the Enter that submitted the last
 * guess cannot also start the next game (FR-73, AC-55).
 */
export function CodeResultPanel({
  won,
  length,
  guessesUsed,
  secret,
  onPlayAgain,
  onChangeLength,
}: CodeResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="code-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="code-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {won ? 'You cracked it!' : 'Out of guesses'}
      </h2>

      <p className="text-sm text-text-muted">
        {String(guessesUsed)} of {String(CODE_MAX_GUESSES)} guesses
      </p>

      <div>
        <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">The word</h3>
        <p className="font-mono text-xl font-bold tracking-widest">{secret}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain}>Play again</Button>
        <ChangeLength lengths={CODE_LENGTHS} current={length} onChange={onChangeLength} />
      </div>
    </section>
  );
}
