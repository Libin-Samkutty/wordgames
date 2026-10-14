import { createContext, useContext } from 'react';

import type { WeaverContextValue } from './WeaverProvider';
import type { WeaverStatsContextValue } from './WeaverStatsProvider';

/**
 * WordWeaver's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as Wordwright's `gameContexts.ts` and `contexts.ts`.
 */

export const WeaverContext = createContext<WeaverContextValue | null>(null);
export const WeaverStatsContext = createContext<WeaverStatsContextValue | null>(null);

export function useWeaver(): WeaverContextValue {
  const value = useContext(WeaverContext);
  if (!value) throw new Error('useWeaver must be used within a WeaverProvider');
  return value;
}

export function useWeaverStats(): WeaverStatsContextValue {
  const value = useContext(WeaverStatsContext);
  if (!value) throw new Error('useWeaverStats must be used within a WeaverStatsProvider');
  return value;
}
