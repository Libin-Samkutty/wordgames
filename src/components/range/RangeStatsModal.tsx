import { useState } from 'react';

import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { WordLength } from '@/engine';
import {
  RANGE_LENGTHS,
  RANGE_MAX_GUESSES,
  RANGE_MAX_GUESSES_OVERALL,
  type RangeRecord,
} from '@/engine/range';
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
  type RangeStatsBucket,
} from '@/storage';

import { Distribution } from '../stats/Distribution';
import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { ViewSwitcher } from '../stats/ViewSwitcher';
import { Modal } from '../ui/Modal';

type View = 'all' | WordLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...RANGE_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-124). */
const RECENT_SHOWN = 8;

export interface RangeStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Mean guesses over wins, read off the distribution, or null with no wins. */
function averageWinGuesses(bucket: RangeStatsBucket): number | null {
  const wins = bucket.distribution.reduce((sum, count) => sum + count, 0);
  if (wins === 0) return null;
  const total = bucket.distribution.reduce((sum, count, index) => sum + count * (index + 1), 0);
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
 * WordRange statistics (FR-124, US-38): overall and per length, played, win
 * percentage, streaks, the win distribution over the length's guesses, recent games, an empty state that
 * never shows NaN (FR-41), and scoped reset actions that can only reach this
 * game's data (FR-47, FR-67).
 */
export function RangeStatsModal({ isOpen, onClose }: RangeStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useRangeStats();
  const [view, setView] = useState<View>('all');

  const bucket = view === 'all' ? stats.overall : stats.perLength[view];
  const guessLimit = view === 'all' ? RANGE_MAX_GUESSES_OVERALL : RANGE_MAX_GUESSES[view];
  const games = stats.recentGames.filter((record) => view === 'all' || record.wordLength === view);
  const hasGames = stats.overall.gamesPlayed > 0;
  const opener = mostUsedOpener(games);
  // Mark the bar of the game just finished, when it is a win in the chosen view.
  const lastGame = stats.recentGames.at(0);
  const highlightIndex =
    lastGame?.won && (view === 'all' || lastGame.wordLength === view)
      ? lastGame.guessesUsed - 1
      : null;
  const burningPercent = rangeBurningPercentage(bucket);

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Win %" value={formatPercent(rangeWinPercentage(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Avg guesses" value={formatAverage(averageWinGuesses(bucket))} />
            <StatTile label="Avg time" value={formatDuration(averageTimedSolveMs(bucket))} />
            <StatTile label="Fastest" value={formatDuration(bucket.fastestSolveMs)} />
            <StatTile
              label="Closest miss"
              value={
                bucket.closestMiss === null
                  ? EMPTY_VALUE
                  : `${formatNumber(bucket.closestMiss)} left`
              }
            />
          </dl>

          {burningPercent === null && opener === null ? null : (
            <p className="text-sm text-text-muted">
              {burningPercent === null
                ? null
                : `Reached Burning in ${formatPercent(burningPercent)} of games, on guess ${formatAverage(rangeAverageFirstBurning(bucket))} on average. `}
              {opener === null ? null : `Favourite opener: ${opener.toUpperCase()}.`}
            </p>
          )}

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
              Wins by guesses (1 to {guessLimit})
            </h3>
            <Distribution counts={bucket.distribution} highlightIndex={highlightIndex} />
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
                        ? `${String(record.guessesUsed)}/${String(RANGE_MAX_GUESSES[record.wordLength])}`
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
