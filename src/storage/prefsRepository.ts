import { createRepository, type Repository, type StorageIssue } from './createRepository';
import { gameKeys } from './keys';
import { DEFAULT_WORDWRIGHT_PREFS, validateWordwrightPrefs, type WordwrightPrefs } from './schemas';

/** Wordwright's default word length, apart from the shared settings (FR-67, FR-46). */
export function createWordwrightPrefsRepository(
  onIssue?: (issue: StorageIssue, key: string) => void,
): Repository<WordwrightPrefs> {
  return createRepository<WordwrightPrefs>({
    key: gameKeys('wordwright').prefs,
    defaults: () => DEFAULT_WORDWRIGHT_PREFS,
    validate: validateWordwrightPrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}
