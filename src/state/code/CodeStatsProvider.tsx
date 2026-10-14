import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { CodeRecord } from '@/engine/code';
import {
  createCodeStatsRepository,
  recordCodeGame,
  resetCodeHistory,
  resetCodeStatistics,
  type CodeStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { CodeStatsContext } from './codeContexts';

export interface CodeStatsContextValue {
  readonly stats: CodeStatsState;
  /** Idempotent by game id (FR-134). */
  readonly recordGame: (record: CodeRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordCode's statistics, apart from every other game's (FR-67, FR-134).
 * Resetting these can only reach `wordgames:v1:code:stats`.
 */
export function CodeStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createCodeStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<CodeStatsState>(() => repository.read());

  // Another tab finished a game (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: CodeStatsState) => CodeStatsState): void => {
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

  const value = useMemo<CodeStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordCodeGame(current, record));
      },
      resetStatistics: () => {
        commit(resetCodeStatistics);
      },
      resetHistory: () => {
        commit(resetCodeHistory);
      },
    }),
    [stats, commit],
  );

  return <CodeStatsContext.Provider value={value}>{children}</CodeStatsContext.Provider>;
}
