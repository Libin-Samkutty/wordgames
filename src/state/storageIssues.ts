/**
 * Cross-cutting flag for storage read failures (EC-12).
 *
 * A module-level value rather than React state, because the failure happens
 * inside a repository read, which runs in a `useState` initialiser, before any
 * component exists to hold state or raise a toast. `StorageNotices` reads it on
 * mount and, because a game's providers can mount long after the shell once
 * game views are lazy chunks (ADR-028), also subscribes to later reports.
 */
let corruptDataSeen = false;
const listeners = new Set<() => void>();

/** Called by the storage layer when a slice had to be discarded. */
export function reportStorageIssue(): void {
  corruptDataSeen = true;

  // Repositories are read during render. Listeners raise a toast, which sets
  // state elsewhere, so they run after the current render rather than inside it.
  queueMicrotask(() => {
    for (const listener of listeners) listener();
  });
}

export function hasCorruptData(): boolean {
  return corruptDataSeen;
}

/** Calls `listener` after each later report. Returns an unsubscribe. */
export function subscribeToStorageIssues(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam. */
export function resetStorageNotices(): void {
  corruptDataSeen = false;
}
