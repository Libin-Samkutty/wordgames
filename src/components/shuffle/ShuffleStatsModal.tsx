import { useState } from 'react';

import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { WordLength } from '@/engine';
import { SHUFFLE_LENGTHS } from '@/engine/shuffle';
import { cn } from '@/lib/cn';
import { formatAverage, formatNumber, formatPercent } from '@/lib/format';
import { useShuffleStats } from '@/state/shuffle';
import { shuffleAverageHints, shuffleGaveUp, shuffleSolvePercentage } from '@/storage';

import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { Modal } from '../ui/Modal';

type View = 'all' | WordLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...SHUFFLE_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-146). */
const RECENT_SHOWN = 8;

export interface ShuffleStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * WordShuffle statistics (FR-146, US-38): played, solved, given up, solve
 * percentage, solved without hints, average hints per solve and streaks, overall
 * and per length, plus recent games, an empty state that never shows NaN
 * (FR-41), and scoped reset actions that can only reach this game's data
 * (FR-47, FR-67).
 */
export function ShuffleStatsModal({ isOpen, onClose }: ShuffleStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useShuffleStats();
  const [view, setView] = useState<View>('all');

  const bucket = view === 'all' ? stats.overall : stats.perLength[view];
  const games = stats.recentGames.filter((record) => view === 'all' || record.length === view);
  const hasGames = stats.overall.gamesPlayed > 0;

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <div role="radiogroup" aria-label="Statistics for" className="flex gap-1">
            {VIEWS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => {
                  setView(value);
                }}
                className={cn(
                  'min-h-9 rounded px-2.5 text-xs font-semibold text-text-muted',
                  'aria-checked:bg-surface-sunken aria-checked:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <dl className="grid grid-cols-4 gap-x-2 gap-y-4">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Solved" value={formatNumber(bucket.gamesSolved)} />
            <StatTile label="Gave up" value={formatNumber(shuffleGaveUp(bucket))} />
            <StatTile label="Solve %" value={formatPercent(shuffleSolvePercentage(bucket))} />
            <StatTile label="No hints" value={formatNumber(bucket.solvedWithoutHints)} />
            <StatTile label="Hints per solve" value={formatAverage(shuffleAverageHints(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          {games.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent games</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {games.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">{record.target}</span>
                    <span className="text-text-muted">
                      {record.solved
                        ? record.hintsUsed === 0
                          ? 'Solved'
                          : `Solved, ${String(record.hintsUsed)} ${record.hintsUsed === 1 ? 'hint' : 'hints'}`
                        : 'Gave up'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-text-muted">
                The last {RECENT_GAMES_LIMIT} games are kept.
              </p>
            </section>
          ) : null}
        </div>
      ) : (
        // FR-41: never show zeros and NaN to a first-time player.
        <p className="py-6 text-center text-sm text-text-muted">
          No games yet. Finish a puzzle and your statistics will appear here.
        </p>
      )}

      {/* Offered whenever there is something to delete, including a kept history after a stats reset. */}
      {hasGames || stats.recentGames.length > 0 ? (
        <div className="mt-6">
          <ResetStatsSection
            statisticsDescription="puzzles played and solved, hints, streaks and solve percentages"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
