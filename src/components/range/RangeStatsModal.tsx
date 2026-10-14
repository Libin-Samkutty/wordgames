import { RANGE_MAX_GUESSES } from '@/engine/range';
import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  EMPTY_VALUE,
  formatAverage,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import { useRangeStats } from '@/state/range';
import {
  averageTimedSolveMs,
  rangeAverageFirstBurning,
  rangeBurningPercentage,
  rangeWinPercentage,
  type RangeStatsState,
} from '@/storage';
import type { RangeRecord } from '@/engine/range';

import { Distribution } from '../stats/Distribution';
import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { Modal } from '../ui/Modal';

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-124). */
const RECENT_SHOWN = 8;

export interface RangeStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Mean guesses over wins, read off the distribution, or null with no wins. */
function averageWinGuesses(stats: RangeStatsState): number | null {
  const wins = stats.distribution.reduce((sum, count) => sum + count, 0);
  if (wins === 0) return null;
  const total = stats.distribution.reduce((sum, count, index) => sum + count * (index + 1), 0);
  return total / wins;
}

/** The first guess played most often in the kept games, or null before there are two to compare. */
function mostUsedOpener(records: readonly RangeRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.opener) counts.set(record.opener, (counts.get(record.opener) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 1;
  for (const [word, count] of counts) {
    if (count > bestCount) {
      best = word;
      bestCount = count;
    }
  }
  return best;
}

/**
 * WordRange statistics (FR-124, US-38): played, win percentage, streaks, the
 * win distribution over guesses 1 to 14, recent games, an empty state that
 * never shows NaN (FR-41), and scoped reset actions that can only reach this
 * game's data (FR-47, FR-67).
 */
export function RangeStatsModal({ isOpen, onClose }: RangeStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useRangeStats();
  const hasGames = stats.gamesPlayed > 0;
  const opener = mostUsedOpener(stats.recentGames);
  const lastGame = stats.recentGames.at(0);
  // Mark the bar of the game just finished, when it was a win.
  const highlightIndex = lastGame?.won ? lastGame.guessesUsed - 1 : null;
  const burningPercent = rangeBurningPercentage(stats);

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Played" value={formatNumber(stats.gamesPlayed)} />
            <StatTile label="Win %" value={formatPercent(rangeWinPercentage(stats))} />
            <StatTile label="Current streak" value={formatNumber(stats.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(stats.bestStreak)} />
          </dl>

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Avg guesses" value={formatAverage(averageWinGuesses(stats))} />
            <StatTile label="Avg time" value={formatDuration(averageTimedSolveMs(stats))} />
            <StatTile label="Fastest" value={formatDuration(stats.fastestSolveMs)} />
            <StatTile
              label="Closest miss"
              value={
                stats.closestMiss === null ? EMPTY_VALUE : `${formatNumber(stats.closestMiss)} left`
              }
            />
          </dl>

          {burningPercent === null && opener === null ? null : (
            <p className="text-sm text-text-muted">
              {burningPercent === null
                ? null
                : `Reached Burning in ${formatPercent(burningPercent)} of games, on guess ${formatAverage(rangeAverageFirstBurning(stats))} on average. `}
              {opener === null ? null : `Favourite opener: ${opener.toUpperCase()}.`}
            </p>
          )}

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
              Wins by guesses (1 to {RANGE_MAX_GUESSES})
            </h3>
            <Distribution counts={stats.distribution} highlightIndex={highlightIndex} />
          </section>

          {stats.recentGames.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent games</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {stats.recentGames.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">{record.secret}</span>
                    <span className="text-text-muted">
                      {record.won
                        ? `${String(record.guessesUsed)}/${String(RANGE_MAX_GUESSES)}`
                        : 'Not found'}
                      {record.won && record.solveMs !== undefined
                        ? ` · ${formatDuration(record.solveMs)}`
                        : ''}
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
          No games yet. Finish a game and your statistics will appear here.
        </p>
      )}

      {/* Offered whenever there is something to delete, including a kept history after a stats reset. */}
      {hasGames || stats.recentGames.length > 0 ? (
        <div className="mt-6">
          <ResetStatsSection
            statisticsDescription="games played, win percentage, streaks, times and the guess distribution"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
