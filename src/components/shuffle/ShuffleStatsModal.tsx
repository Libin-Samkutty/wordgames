import { useState } from 'react';

import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { WordLength } from '@/engine';
import { SHUFFLE_LENGTHS, timeBucketIndex } from '@/engine/shuffle';
import { formatAverage, formatDuration, formatNumber, formatPercent } from '@/lib/format';
import { useShuffleStats } from '@/state/shuffle';
import {
  averageTimedSolveMs,
  shuffleAltAnswerPercentage,
  shuffleAverageHints,
  shuffleGaveUp,
  shuffleHintDistribution,
  shuffleSolvePercentage,
} from '@/storage';

import { Distribution } from '../stats/Distribution';
import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { ViewSwitcher } from '../stats/ViewSwitcher';
import { Modal } from '../ui/Modal';

type View = 'all' | WordLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...SHUFFLE_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

const TIME_LABELS = ['< 10s', '< 30s', '< 1m', '< 2m', '2m +'] as const;
const HINT_LABELS = ['0', '1', '2'] as const;

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
  const altPercent = shuffleAltAnswerPercentage(bucket);

  // Mark the bars of the puzzle just solved, when it is in the chosen view.
  const lastGame = stats.recentGames.at(0);
  const lastSolved = lastGame?.solved && (view === 'all' || lastGame.length === view);
  const timeHighlight =
    lastSolved && lastGame.solveMs !== undefined ? timeBucketIndex(lastGame.solveMs) : null;
  const hintHighlight = lastSolved ? lastGame.hintsUsed : null;

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />

          <dl className="grid grid-cols-4 gap-x-2 gap-y-4">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Solved" value={formatNumber(bucket.gamesSolved)} />
            <StatTile label="Gave up" value={formatNumber(shuffleGaveUp(bucket))} />
            <StatTile label="Solve %" value={formatPercent(shuffleSolvePercentage(bucket))} />
            <StatTile label="No hints" value={formatNumber(bucket.solvedWithoutHints)} />
            <StatTile label="Hints per solve" value={formatAverage(shuffleAverageHints(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
            <StatTile label="Avg time" value={formatDuration(averageTimedSolveMs(bucket))} />
            <StatTile label="Fastest" value={formatDuration(bucket.fastestSolveMs)} />
          </dl>

          {altPercent === null ? null : (
            <p className="text-sm text-text-muted">
              In puzzles with several answers, you found another word {formatPercent(altPercent)} of
              the time.
            </p>
          )}

          {bucket.timedSolves > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Solves by time</h3>
              <Distribution
                counts={bucket.timeDistribution}
                labels={TIME_LABELS}
                highlightIndex={timeHighlight}
              />
            </section>
          ) : null}

          {bucket.gamesSolved > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
                Solves by hints used
              </h3>
              <Distribution
                counts={shuffleHintDistribution(bucket)}
                labels={HINT_LABELS}
                highlightIndex={hintHighlight}
              />
            </section>
          ) : null}

          {games.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent games</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {games.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">
                      {record.found !== null && record.found !== record.target
                        ? `${record.found} (${record.target})`
                        : record.target}
                    </span>
                    <span className="text-text-muted">
                      {record.solved
                        ? record.hintsUsed === 0
                          ? 'Solved'
                          : `Solved, ${String(record.hintsUsed)} ${record.hintsUsed === 1 ? 'hint' : 'hints'}`
                        : 'Gave up'}
                      {record.solved && record.solveMs !== undefined
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
          No games yet. Finish a puzzle and your statistics will appear here.
        </p>
      )}

      {/* Offered whenever there is something to delete, including a kept history after a stats reset. */}
      {hasGames || stats.recentGames.length > 0 ? (
        <div className="mt-6">
          <ResetStatsSection
            statisticsDescription="puzzles played and solved, hints, times, streaks and solve percentages"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
