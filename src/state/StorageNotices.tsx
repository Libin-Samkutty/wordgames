import { useEffect, useRef } from 'react';

import { safeStorage } from '@/storage';

import { useToast } from './contexts';
import { hasCorruptData, subscribeToStorageIssues } from './storageIssues';

/**
 * Surfaces storage problems to the player exactly once per session
 * (SPEC §11, EC-11, EC-12).
 *
 * Both conditions are recoverable and the game stays fully playable, so these
 * are polite notices rather than errors, but staying silent would let someone
 * finish a long streak believing it had been saved when it had not.
 *
 * Each game reads its own storage slices when its providers mount, which can
 * be after the shell. So a slice found corrupt later still produces its one
 * notice (EC-26): it subscribes to reports as well as checking on mount.
 */
export function StorageNotices(): null {
  const { show } = useToast();
  const corruptShown = useRef(false);

  useEffect(() => {
    if (!safeStorage.isPersistent) {
      show("Progress can't be saved in this browser mode");
      // Nothing is persisted, so nothing can be found corrupt.
      return;
    }

    const noticeCorruptData = (): void => {
      if (corruptShown.current || !hasCorruptData()) return;
      corruptShown.current = true;
      show("Saved data was reset because it couldn't be read");
    };

    noticeCorruptData();
    return subscribeToStorageIssues(noticeCorruptData);
  }, [show]);

  return null;
}
