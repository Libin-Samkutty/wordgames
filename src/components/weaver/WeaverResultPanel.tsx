import { WEAVER_LENGTHS, type ResultSummary, type WeaverLength } from '@/engine/weaver';
import { useEnterToContinue } from '@/hooks/useEnterToContinue';

import { ChangeLength } from '../game/ChangeLength';
import { Button } from '../ui/Button';

export interface WeaverResultPanelProps {
  readonly solved: boolean;
  readonly summary: ResultSummary;
  readonly length: WeaverLength;
  /** The player's ladder: the start word, then each rung. */
  readonly playerLadder: readonly string[];
  /** One shortest ladder, shown after a give up (FR-86). */
  readonly optimalLadder: readonly string[] | null;
  readonly onPlayAgain: () => void;
  readonly onChangeLength: (length: WeaverLength) => void;
}

function Ladder({ label, words }: { label: string; words: readonly string[] }): React.JSX.Element {
  return (
    <div>
      <h3 className="mb-1 text-xs tracking-wide text-text-muted uppercase">{label}</h3>
      <ol className="flex flex-wrap justify-center gap-x-1 font-mono text-sm font-bold tracking-wider">
        {words.map((word, index) => (
          <li key={`${word}-${String(index)}`}>
            {index > 0 ? (
              <span aria-hidden="true" className="px-0.5 text-text-muted">
                →
              </span>
            ) : null}
            {word}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Shown when the puzzle ends (FR-91, US-30): solved or gave up, moves against
 * par, the player's ladder, and after a give up one shortest ladder.
 *
 * It mounts only after the final reveal, so the Enter that submitted the end
 * word cannot also start the next puzzle (FR-73, AC-29).
 */
export function WeaverResultPanel({
  solved,
  summary,
  length,
  playerLadder,
  optimalLadder,
  onPlayAgain,
  onChangeLength,
}: WeaverResultPanelProps): React.JSX.Element {
  // Physical Enter does what Play again does (FR-72, ADR-027).
  useEnterToContinue(onPlayAgain);

  return (
    <section
      aria-labelledby="weaver-result-heading"
      className="flex w-full max-w-md animate-fade-in flex-col items-center gap-3 rounded-lg bg-surface-raised px-4 py-4 text-center"
    >
      <h2 id="weaver-result-heading" className="text-lg font-bold tracking-wide uppercase">
        {solved ? 'Solved!' : 'Gave up'}
      </h2>

      <p className="text-sm text-text-muted">
        {String(summary.moves)} {summary.moves === 1 ? 'move' : 'moves'} · Par {summary.par}
        {summary.label ? (
          <>
            {' · '}
            <strong className="font-bold text-text">{summary.label}</strong>
          </>
        ) : null}
      </p>

      <Ladder label="Your ladder" words={playerLadder} />
      {optimalLadder ? <Ladder label="A shortest ladder" words={optimalLadder} /> : null}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain}>Play again</Button>
        <ChangeLength lengths={WEAVER_LENGTHS} current={length} onChange={onChangeLength} />
      </div>
    </section>
  );
}
