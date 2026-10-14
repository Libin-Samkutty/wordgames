/**
 * Solve-time counters shared by the WordGames whose buckets did not always keep
 * a time. They have their own `timedSolves` count because wins saved before
 * time was tracked have no time, so dividing by `gamesWon` would skew the average.
 */
export interface TimeStats {
  readonly timedSolves: number;
  readonly totalSolveMs: number;
  readonly fastestSolveMs: number | null;
}

export function emptyTimeStats(): TimeStats {
  return { timedSolves: 0, totalSolveMs: 0, fastestSolveMs: null };
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Reads the time counters from a stored bucket. A bucket saved before they
 * existed has none, which reads as no timed solves yet. Returns null when a
 * field is present but wrong, so a corrupt bucket is still rejected.
 */
export function readTimeStats(value: Record<string, unknown>): TimeStats | null {
  const { timedSolves, totalSolveMs, fastestSolveMs } = value;

  if (timedSolves === undefined && totalSolveMs === undefined && fastestSolveMs === undefined) {
    return emptyTimeStats();
  }

  if (typeof timedSolves !== 'number' || !Number.isInteger(timedSolves) || timedSolves < 0) {
    return null;
  }
  if (!isNonNegativeNumber(totalSolveMs)) return null;
  if (fastestSolveMs !== null && !isNonNegativeNumber(fastestSolveMs)) return null;

  return { timedSolves, totalSolveMs, fastestSolveMs: fastestSolveMs };
}

/**
 * Adds one solve and returns only the three time fields, so it is safe to spread
 * into a bucket. A record with no time (an old row) leaves them unchanged.
 */
export function addSolveTime(stats: TimeStats, solveMs: number | undefined): TimeStats {
  const { timedSolves, totalSolveMs, fastestSolveMs } = stats;
  if (solveMs === undefined) return { timedSolves, totalSolveMs, fastestSolveMs };

  return {
    timedSolves: stats.timedSolves + 1,
    totalSolveMs: stats.totalSolveMs + solveMs,
    fastestSolveMs:
      stats.fastestSolveMs === null ? solveMs : Math.min(stats.fastestSolveMs, solveMs),
  };
}

/** Mean solve time in ms, or null with no timed solves. */
export function averageTimedSolveMs(stats: TimeStats): number | null {
  if (stats.timedSolves === 0) return null;
  return stats.totalSolveMs / stats.timedSolves;
}
