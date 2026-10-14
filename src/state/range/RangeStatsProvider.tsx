import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { RangeRecord } from '@/engine/range';
import {
  createRangeStatsRepository,
  recordRangeGame,
  resetRangeHistory,
  resetRangeStatistics,
  type RangeStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { RangeStatsContext } from './rangeContexts';

export interface RangeStatsContextValue {
  readonly stats: RangeStatsState;
  /** Idempotent by game id (FR-124). */
  readonly recordGame: (record: RangeRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordRange's statistics, apart from every other game's (FR-67, FR-124).
 * Resetting these can only reach `wordgames:v1:range:stats`.
 */
export function RangeStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createRangeStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<RangeStatsState>(() => repository.read());

  // Another tab finished a game (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: RangeStatsState) => RangeStatsState): void => {
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

  const value = useMemo<RangeStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordRangeGame(current, record));
      },
      resetStatistics: () => {
        commit(resetRangeStatistics);
      },
      resetHistory: () => {
        commit(resetRangeHistory);
      },
    }),
    [stats, commit],
  );

  return <RangeStatsContext.Provider value={value}>{children}</RangeStatsContext.Provider>;
}
