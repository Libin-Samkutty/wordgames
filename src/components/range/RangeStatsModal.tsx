import { RANGE_MAX_GUESSES } from '@/engine/range';
import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { formatNumber, formatPercent } from '@/lib/format';
import { useRangeStats } from '@/state/range';
import { rangeWinPercentage } from '@/storage';

import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { Modal } from '../ui/Modal';

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-124). */
const RECENT_SHOWN = 8;

function Distribution({ counts }: { counts: readonly number[] }): React.JSX.Element {
  const max = Math.max(1, ...counts);

  return (
    <div className="flex flex-col gap-1">
      {counts.map((count, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="w-4 tabular-nums">{index + 1}</span>
          <div className="flex-1">
            <div
              className="flex justify-end rounded-sm bg-tile-absent px-1.5 py-0.5 text-xs font-bold text-tile-text-revealed data-[has-count=true]:bg-tile-correct"
              style={{ width: `${String(Math.max(7, (count / max) * 100))}%` }}
              data-has-count={count > 0}
            >
              {count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface RangeStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
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

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
              Wins by guesses (1 to {RANGE_MAX_GUESSES})
            </h3>
            <Distribution counts={stats.distribution} />
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
            statisticsDescription="games played, win percentage, streaks and the guess distribution"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
