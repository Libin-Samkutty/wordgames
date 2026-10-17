import type { WordLength } from '@/engine';
import { DODGE_LENGTHS } from '@/engine/dodge';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';
import { formatDuration } from '@/lib/format';

import { ChangeLength } from '../game/ChangeLength';
import { Button } from '../ui/Button';

export interface DodgeResultPanelProps {
  readonly won: boolean;
  readonly length: WordLength;
  /** The word found, or the word the game showed after a give up. */
  readonly word: string;
  readonly guessesUsed: number;
  /** How long the game took, in ms, or absent when the clock never started. */
  readonly elapsedMs?: number | null;
  /** After a give up, how many other words were still possible. */
  readonly othersLeft: number;
  readonly onPlayAgain: () => void;
  readonly onChangeLength: (length: WordLength) => void;
}

/**
 * Shown when the game ends (FR-154): found or gave up, the word, guesses used,
 * the time, **Play again** (same length) and **Change length**.
 *
 * It mounts only once the game is over, so the Enter that submitted the last
 * guess cannot also start the next game (FR-73, AC-55).
 */
export function DodgeResultPanel({
  won,
  length,
  word,
  guessesUsed,
  elapsedMs = null,
  othersLeft,
  onPlayAgain,
  onChangeLength,
}: DodgeResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="dodge-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="dodge-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {won ? 'You cornered it!' : 'Gave up'}
      </h2>

      <p className="text-sm text-text-muted">
        {String(guessesUsed)} {guessesUsed === 1 ? 'guess' : 'guesses'}
        {elapsedMs === null || elapsedMs <= 0 ? '' : ` · ${formatDuration(elapsedMs)}`}
      </p>

      <div>
        <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">
          {won ? 'The word' : 'It could have been'}
        </h3>
        <p className="font-mono text-xl font-bold tracking-widest">{word}</p>
      </div>

      {!won && othersLeft > 0 ? (
        <p className="text-sm text-text-muted">
          {String(othersLeft)} other {othersLeft === 1 ? 'word was' : 'words were'} still possible.
        </p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain}>Play again</Button>
        <ChangeLength lengths={DODGE_LENGTHS} current={length} onChange={onChangeLength} />
      </div>
    </section>
  );
}
