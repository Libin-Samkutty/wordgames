import { createRepository, type Repository, type StorageIssue } from './createRepository';
import { STORAGE_KEYS } from './keys';
import { DEFAULT_SETTINGS, validateSettings, type Settings } from './schemas';

/** Appearance settings shared by every game (FR-67). */
export function createSettingsRepository(
  onIssue?: (issue: StorageIssue, key: string) => void,
): Repository<Settings> {
  return createRepository<Settings>({
    key: STORAGE_KEYS.settings,
    defaults: () => DEFAULT_SETTINGS,
    validate: validateSettings,
    ...(onIssue ? { onIssue } : {}),
  });
}

export { DEFAULT_SETTINGS };
export type { Settings };
