import { expect, test, type Page } from '@playwright/test';

/**
 * The rename must cost returning players nothing (T-53, US-23, AC-27, G9).
 *
 * These seed the pre-rename `wordwright:v1:*` keys the way an old visit would
 * have left them, then load the renamed app.
 */

const CORRECT = 'correct';
const ABSENT = 'absent';
const PRESENT = 'present';

const bucket = {
  gamesPlayed: 12,
  gamesWon: 9,
  currentStreak: 3,
  bestStreak: 5,
  distribution: [0, 1, 3, 3, 2, 0],
  totalGuessesInWins: 33,
  totalScore: 5400,
  totalSolveMs: 540_000,
  fastestSolveMs: 21_000,
};

const empty = { ...bucket, gamesPlayed: 0, gamesWon: 0, currentStreak: 0, bestStreak: 0 };
const emptyBucket = {
  ...empty,
  distribution: [0, 0, 0, 0, 0, 0],
  totalGuessesInWins: 0,
  totalScore: 0,
  totalSolveMs: 0,
  fastestSolveMs: null,
};

/** Dark theme, 12 completed games, and a game in progress with 2 guesses. */
const LEGACY: Record<string, string> = {
  'wordwright:v1:settings': JSON.stringify({
    theme: 'dark',
    colorblind: false,
    motion: 'reduced',
    defaultWordLength: 5,
  }),
  'wordwright:v1:stats': JSON.stringify({
    overall: bucket,
    perLength: { 4: emptyBucket, 5: bucket, 6: emptyBucket },
    recentGames: [],
    recordedGameIds: [],
  }),
  'wordwright:v1:session': JSON.stringify({
    id: 'legacy-game',
    wordLength: 5,
    answer: 'ABOUT',
    guesses: [
      { word: 'SLOTH', evaluation: [ABSENT, ABSENT, CORRECT, PRESENT, ABSENT] },
      { word: 'STAMP', evaluation: [ABSENT, PRESENT, PRESENT, ABSENT, ABSENT] },
    ],
    currentInput: '',
    status: 'playing',
    startedAt: 1_700_000_000_000,
    finishedAt: null,
  }),
  'wordwright:v1:meta': JSON.stringify({
    schemaVersion: 1,
    recentAnswers: { 4: [], 5: ['ABOUT'], 6: [] },
  }),
};

/** Seeds the legacy keys on the first navigation only, so a reload sees the real result. */
async function seedLegacyOnce(page: Page): Promise<void> {
  await page.addInitScript((data: Record<string, string>) => {
    if (sessionStorage.getItem('legacy-seeded')) return;
    sessionStorage.setItem('legacy-seeded', '1');
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
  }, LEGACY);
}

async function legacyKeys(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(
    (keys: string[]) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    Object.keys(LEGACY),
  );
}

test.describe('legacy import (AC-27)', () => {
  test('paints the legacy dark theme before any script runs (FR-70)', async ({ page }) => {
    await seedLegacyOnce(page);
    // Stop the app bundle so only the inline script in index.html can have
    // applied the theme. If it did not, the page would be the light default.
    await page.route('**/assets/*.js', (route) => route.abort());

    await page.goto('/');

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  });

  test('keeps stats and the game in progress, and never imports twice', async ({ page }) => {
    await seedLegacyOnce(page);
    await page.goto('/#/wordwright');

    await expect(page.getByRole('grid', { name: 'Guess board' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // The 2-guess game is restored.
    const rows = page.getByRole('row');
    await expect(rows.nth(0).getByRole('gridcell').first()).toHaveAccessibleName(/letter 1: S/);
    await expect(rows.nth(1).getByRole('gridcell').first()).toHaveAccessibleName(/letter 1: S/);
    await expect(rows.nth(2).getByRole('gridcell').first()).toHaveAccessibleName(/empty/);

    // Stats show 12 games.
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog').getByText('Played').locator('..')).toContainText('12');
    await page.keyboard.press('Escape');

    // The marker exists and the legacy keys are untouched.
    const marker = await page.evaluate(() => localStorage.getItem('wordgames:v1:meta'));
    expect(marker).not.toBeNull();
    expect(await legacyKeys(page)).toEqual(LEGACY);

    // A second load does not import again.
    await page.reload();
    await expect(page.getByRole('grid', { name: 'Guess board' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('wordgames:v1:meta'))).toBe(marker);
    expect(await legacyKeys(page)).toEqual(LEGACY);
  });
});
