import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { DodgeRecord } from '@/engine/dodge';
import {
  createDodgeStatsRepository,
  recordDodgeGame,
  resetDodgeHistory,
  resetDodgeStatistics,
  type DodgeStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { DodgeStatsContext } from './dodgeContexts';

export interface DodgeStatsContextValue {
  readonly stats: DodgeStatsState;
  /** Idempotent by game id (FR-155). */
  readonly recordGame: (record: DodgeRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordDodge's statistics, apart from every other game's (FR-67, FR-155).
 * Resetting these can only reach `wordgames:v1:dodge:stats`.
 */
export function DodgeStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createDodgeStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<DodgeStatsState>(() => repository.read());

  // Another tab finished a game (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: DodgeStatsState) => DodgeStatsState): void => {
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

  const value = useMemo<DodgeStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordDodgeGame(current, record));
      },
      resetStatistics: () => {
        commit(resetDodgeStatistics);
      },
      resetHistory: () => {
        commit(resetDodgeHistory);
      },
    }),
    [stats, commit],
  );

  return <DodgeStatsContext.Provider value={value}>{children}</DodgeStatsContext.Provider>;
}
