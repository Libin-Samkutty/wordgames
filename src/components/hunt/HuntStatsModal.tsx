import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { formatDuration, formatNumber, formatPercent } from '@/lib/format';
import { useHuntStats } from '@/state/hunt';
import { averageTimedSolveMs, huntCompletionPercentage, huntWordsFoundPercentage } from '@/storage';

import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { Modal } from '../ui/Modal';

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-165). */
const RECENT_SHOWN = 8;

export interface HuntStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * WordHunt statistics (FR-165, US-40): the puzzles played and completed, the
 * share of words found, bonus words, times, recent puzzles, an empty state that
 * never shows NaN (FR-41), and scoped reset actions that can only reach this
 * game's data (FR-47, FR-67). There is one size of puzzle, so there is no
 * per-length view.
 */
export function HuntStatsModal({ isOpen, onClose }: HuntStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useHuntStats();

  const bucket = stats.overall;
  const hasGames = bucket.gamesPlayed > 0;
  const foundPercentage = huntWordsFoundPercentage(bucket);

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Done %" value={formatPercent(huntCompletionPercentage(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          <dl className="grid grid-cols-4 gap-2">
            <StatTile
              label="Words found"
              value={foundPercentage === null ? '—' : formatPercent(foundPercentage)}
            />
            <StatTile label="Bonus words" value={formatNumber(bucket.totalBonus)} />
            <StatTile label="Avg time" value={formatDuration(averageTimedSolveMs(bucket))} />
            <StatTile label="Fastest" value={formatDuration(bucket.fastestSolveMs)} />
          </dl>

          {stats.recentGames.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent puzzles</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {stats.recentGames.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">{record.seed}</span>
                    <span className="text-text-muted">
                      {String(record.foundCount)} of {String(record.requiredCount)}
                      {record.completed ? ` · ${formatDuration(record.solveMs)}` : ' · gave up'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-text-muted">
                The last {RECENT_GAMES_LIMIT} puzzles are kept.
              </p>
            </section>
          ) : null}
        </div>
      ) : (
        // FR-41: never show zeros and NaN to a first-time player.
        <p className="py-6 text-center text-sm text-text-muted">
          No puzzles yet. Finish a puzzle and your statistics will appear here.
        </p>
      )}

      {/* Offered whenever there is something to delete, including a kept history after a stats reset. */}
      {hasGames || stats.recentGames.length > 0 ? (
        <div className="mt-6">
          <ResetStatsSection
            statisticsDescription="puzzles played, completion, streaks, words found and times"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
