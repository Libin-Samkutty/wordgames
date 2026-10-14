import { isOwnedKey } from './keys';
import { safeStorage, type SafeStorage } from './safeStorage';

/**
 * Removes every key the app has ever owned, in both the `wordgames:` and the
 * legacy `wordwright:` namespaces (FR-71, EC-21).
 *
 * Enumerates the live store rather than a fixed list, so keys written by a
 * later game or an older version are cleared too.
 */
export function resetAllData(storage: SafeStorage = safeStorage): void {
  for (const key of storage.keys().filter(isOwnedKey)) {
    storage.removeItem(key);
  }
}
