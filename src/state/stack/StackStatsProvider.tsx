import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { StackRecord } from '@/engine/stack';
import {
  createStackStatsRepository,
  recordStackGame,
  resetStackHistory,
  resetStackStatistics,
  type StackStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { StackStatsContext } from './stackContexts';

export interface StackStatsContextValue {
  readonly stats: StackStatsState;
  /** Idempotent by game id (FR-111). */
  readonly recordGame: (record: StackRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordStack's statistics, apart from every other game's (FR-67, FR-111).
 * Resetting these can only reach `wordgames:v1:stack:stats`.
 */
export function StackStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createStackStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<StackStatsState>(() => repository.read());

  // Another tab finished a game (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: StackStatsState) => StackStatsState): void => {
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

  const value = useMemo<StackStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordStackGame(current, record));
      },
      resetStatistics: () => {
        commit(resetStackStatistics);
      },
      resetHistory: () => {
        commit(resetStackHistory);
      },
    }),
    [stats, commit],
  );

  return <StackStatsContext.Provider value={value}>{children}</StackStatsContext.Provider>;
}
