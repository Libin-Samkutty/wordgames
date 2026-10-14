import { createContext, useContext } from 'react';

import type { StackContextValue } from './StackProvider';
import type { StackStatsContextValue } from './StackStatsProvider';

/**
 * WordStack's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as WordWeaver's `weaverContexts.ts`.
 */

export const StackContext = createContext<StackContextValue | null>(null);
export const StackStatsContext = createContext<StackStatsContextValue | null>(null);

export function useStack(): StackContextValue {
  const value = useContext(StackContext);
  if (!value) throw new Error('useStack must be used within a StackProvider');
  return value;
}

export function useStackStats(): StackStatsContextValue {
  const value = useContext(StackStatsContext);
  if (!value) throw new Error('useStackStats must be used within a StackStatsProvider');
  return value;
}
