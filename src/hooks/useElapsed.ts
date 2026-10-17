import { useEffect, useState } from 'react';

import { clampDuration, now } from '@/lib/clock';

/** How often a running clock redraws, in ms. The display shows whole seconds. */
const TICK_MS = 1000;

/**
 * The time a game has taken, in ms, for a count-up clock (ADR-038).
 *
 * It reads 0 until `startedAt` is set, ticks once a second while the game runs,
 * and holds still at `finishedAt - startedAt` once it ends. Both times are epoch
 * ms from the saved game, so a game restored after a reload keeps counting from
 * its first keystroke, as the solve time recorded for statistics does.
 */
export function useElapsed(startedAt: number | null, finishedAt: number | null): number {
  const running = startedAt !== null && finishedAt === null;
  const [current, setCurrent] = useState(now);

  useEffect(() => {
    if (!running) return;

    // No catch-up call here: a game restored mid-way mounts with the time already
    // current, and a game that starts later reads 0 until its first tick.
    const timer = setInterval(() => {
      setCurrent(now());
    }, TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [running]);

  if (startedAt === null) return 0;
  return clampDuration((finishedAt ?? current) - startedAt);
}
