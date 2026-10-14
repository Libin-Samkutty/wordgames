import { useState } from 'react';

import { MAX_GUESSES, WORD_LENGTHS, type GameRecord, type WordLength } from '@/engine';
import {
  EMPTY_VALUE,
  formatAverage,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import { useStats } from '@/state';
import { averageGuesses, averageSolveMs, winPercentage } from '@/storage';

import { Modal } from '../ui/Modal';
import { Distribution } from './Distribution';
import { ResetStatsSection } from './ResetStatsSection';
import { StatTile } from './StatTile';
import { ViewSwitcher } from './ViewSwitcher';

type View = 'all' | WordLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...WORD_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

/** The first guess played most often in the kept games, or null before there are two to compare. */
function mostUsedOpener(records: readonly GameRecord[]): string | null {
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

export function StatsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useStats();
  const [view, setView] = useState<View>('all');

  const bucket = view === 'all' ? stats.overall : stats.perLength[view];
  const games = stats.recentGames.filter((record) => view === 'all' || record.wordLength === view);
  const hasGames = stats.overall.gamesPlayed > 0;
  const opener = mostUsedOpener(games);

  // Wins saved before the best score was tracked still count: take the better of the two.
  const bestScore = Math.max(
    bucket.bestScore,
    ...games.filter((record) => record.won).map((record) => record.score),
  );

  // Mark the bar of the game just finished, when it was a win in the chosen view.
  const lastGame = stats.recentGames.at(0);
  const highlightIndex =
    lastGame?.won && (view === 'all' || lastGame.wordLength === view)
      ? lastGame.guessesUsed - 1
      : null;

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Win %" value={formatPercent(winPercentage(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Avg guesses" value={formatAverage(averageGuesses(bucket))} />
            <StatTile label="Avg time" value={formatDuration(averageSolveMs(bucket))} />
            <StatTile label="Fastest" value={formatDuration(bucket.fastestSolveMs)} />
            <StatTile label="Score" value={formatNumber(bucket.totalScore)} />
          </dl>

          <p className="text-sm text-text-muted">
            Best score in one game: {bestScore > 0 ? formatNumber(bestScore) : EMPTY_VALUE}.
            {opener === null ? null : ` Favourite opener: ${opener.toUpperCase()}.`}
          </p>

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Guess distribution</h3>
            <Distribution
              counts={bucket.distribution.slice(0, MAX_GUESSES)}
              highlightIndex={highlightIndex}
            />
          </section>

          {games.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent games</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {games.slice(0, 8).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">{record.answer}</span>
                    <span className="text-text-muted">
                      {record.won ? `${String(record.guessesUsed)}/${String(MAX_GUESSES)}` : 'X'} ·{' '}
                      {formatDuration(record.solveMs)}
                    </span>
                  </li>
                ))}
              </ul>
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
            statisticsDescription="games played, streaks, distribution and scores"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
