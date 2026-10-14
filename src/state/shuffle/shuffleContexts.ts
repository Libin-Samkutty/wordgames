import { createContext, useContext } from 'react';

import type { ShuffleContextValue } from './ShuffleProvider';
import type { ShuffleStatsContextValue } from './ShuffleStatsProvider';

/**
 * WordShuffle's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as WordStack's `stackContexts.ts`.
 */

export const ShuffleContext = createContext<ShuffleContextValue | null>(null);
export const ShuffleStatsContext = createContext<ShuffleStatsContextValue | null>(null);

export function useShuffle(): ShuffleContextValue {
  const value = useContext(ShuffleContext);
  if (!value) throw new Error('useShuffle must be used within a ShuffleProvider');
  return value;
}

export function useShuffleStats(): ShuffleStatsContextValue {
  const value = useContext(ShuffleStatsContext);
  if (!value) throw new Error('useShuffleStats must be used within a ShuffleStatsProvider');
  return value;
}
