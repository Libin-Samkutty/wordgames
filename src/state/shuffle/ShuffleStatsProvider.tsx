import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ShuffleRecord } from '@/engine/shuffle';
import {
  createShuffleStatsRepository,
  recordShuffleGame,
  resetShuffleHistory,
  resetShuffleStatistics,
  type ShuffleStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { ShuffleStatsContext } from './shuffleContexts';

export interface ShuffleStatsContextValue {
  readonly stats: ShuffleStatsState;
  /** Idempotent by game id (FR-146). */
  readonly recordGame: (record: ShuffleRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordShuffle's statistics, apart from every other game's (FR-67, FR-146).
 * Resetting these can only reach `wordgames:v1:shuffle:stats`.
 */
export function ShuffleStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createShuffleStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<ShuffleStatsState>(() => repository.read());

  // Another tab finished a puzzle (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: ShuffleStatsState) => ShuffleStatsState): void => {
      setStats((current) => {
        const next = transform(current);
        // Nothing changed (a duplicate record); skip the write and the re-render.
        if (next === current) return current;

        repository.write(next);
        return next;
      });
    },
    [repository],
  );

  const value = useMemo<ShuffleStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordShuffleGame(current, record));
      },
      resetStatistics: () => {
        commit(resetShuffleStatistics);
      },
      resetHistory: () => {
        commit(resetShuffleHistory);
      },
    }),
    [stats, commit],
  );

  return <ShuffleStatsContext.Provider value={value}>{children}</ShuffleStatsContext.Provider>;
}
