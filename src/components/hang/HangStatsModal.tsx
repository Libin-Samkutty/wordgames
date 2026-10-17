import { useState } from 'react';

import type { WordLength } from '@/engine';
import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { HANG_LENGTHS, MAX_MISSES } from '@/engine/hang';
import { formatAverage, formatDuration, formatNumber, formatPercent } from '@/lib/format';
import { useHangStats } from '@/state/hang';
import {
  averageTimedSolveMs,
  hangAverageMisses,
  hangPerfectWins,
  hangWinPercentage,
} from '@/storage';

import { Distribution } from '../stats/Distribution';
import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { ViewSwitcher } from '../stats/ViewSwitcher';
import { Modal } from '../ui/Modal';

type View = 'all' | WordLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...HANG_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-174). */
const RECENT_SHOWN = 8;

export interface HangStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * WordHang statistics (FR-174, US-41): overall and per length, the wins by
 * misses (0 to 5), recent games, an empty state that never shows NaN (FR-41),
 * and scoped reset actions that can only reach this game's data (FR-47, FR-67).
 */
export function HangStatsModal({ isOpen, onClose }: HangStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useHangStats();
  const [view, setView] = useState<View>('all');

  const bucket = view === 'all' ? stats.overall : stats.perLength[view];
  const games = stats.recentGames.filter((record) => view === 'all' || record.length === view);
  const hasGames = stats.overall.gamesPlayed > 0;
  // Mark the bar of the game just finished, when it is a win in the chosen view.
  const lastGame = stats.recentGames.at(0);
  const highlightIndex =
    lastGame?.won && (view === 'all' || lastGame.length === view) ? lastGame.misses : null;

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Win %" value={formatPercent(hangWinPercentage(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Avg misses" value={formatAverage(hangAverageMisses(bucket))} />
            <StatTile label="No misses" value={formatNumber(hangPerfectWins(bucket))} />
            <StatTile label="Avg time" value={formatDuration(averageTimedSolveMs(bucket))} />
            <StatTile label="Fastest" value={formatDuration(bucket.fastestSolveMs)} />
          </dl>

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
              Wins by misses (0 to {MAX_MISSES - 1})
            </h3>
            <Distribution
              counts={bucket.distribution}
              firstLabel={0}
              highlightIndex={highlightIndex}
            />
          </section>

          {games.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent games</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {games.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">{record.secret}</span>
                    <span className="text-text-muted">
                      {record.won
                        ? `${String(record.misses)} ${record.misses === 1 ? 'miss' : 'misses'} · ${formatDuration(record.solveMs)}`
                        : 'Lost'}
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
            statisticsDescription="games played, win percentages, streaks, times and the misses distribution"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
