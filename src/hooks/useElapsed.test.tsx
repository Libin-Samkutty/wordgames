import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { now } from '@/lib/clock';

import { useElapsed } from './useElapsed';

/** The count-up clock hook (ADR-038). */

function Clock({
  startedAt,
  finishedAt,
}: {
  startedAt: number | null;
  finishedAt: number | null;
}): React.JSX.Element {
  return <output>{String(useElapsed(startedAt, finishedAt))}</output>;
}

const ms = (): number => Number(screen.getByRole('status').textContent);

describe('useElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads 0 before the game has started, and does not tick', () => {
    render(<Clock startedAt={null} finishedAt={null} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(ms()).toBe(0);
  });

  it('counts up from the start, once a second', () => {
    const startedAt = now();
    render(<Clock startedAt={startedAt} finishedAt={null} />);
    expect(ms()).toBeLessThan(1000);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(ms()).toBeGreaterThanOrEqual(3000);
    expect(ms()).toBeLessThan(4500);
  });

  it('holds still at the finish time once the game is over', () => {
    render(<Clock startedAt={1_000} finishedAt={43_000} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(ms()).toBe(42_000);
  });

  it('stops ticking when the game ends', () => {
    const startedAt = now();
    const { rerender } = render(<Clock startedAt={startedAt} finishedAt={null} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    rerender(<Clock startedAt={startedAt} finishedAt={startedAt + 2500} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(ms()).toBe(2500);
  });

  it('starts counting when the first keystroke sets the start time', () => {
    const { rerender } = render(<Clock startedAt={null} finishedAt={null} />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(ms()).toBe(0);

    const startedAt = now();
    rerender(<Clock startedAt={startedAt} finishedAt={null} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(ms()).toBeGreaterThanOrEqual(2000);
    expect(ms()).toBeLessThan(3500);
  });

  it('counts the time away for a game restored from an earlier start', () => {
    render(<Clock startedAt={now() - 90_000} finishedAt={null} />);

    expect(ms()).toBeGreaterThanOrEqual(90_000);
  });

  it('never goes negative or absurd, even for a start time in the future', () => {
    render(<Clock startedAt={now() + 60_000} finishedAt={null} />);

    expect(ms()).toBe(0);
  });

  it('stops its timer when it unmounts', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<Clock startedAt={now()} finishedAt={null} />);

    unmount();

    expect(clear).toHaveBeenCalled();
  });
});
