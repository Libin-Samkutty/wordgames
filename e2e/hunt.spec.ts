import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import * as lists4 from '../src/dictionary/data/lists-4';
import * as lists5 from '../src/dictionary/data/lists-5';
import * as lists6 from '../src/dictionary/data/lists-6';

/**
 * WordHunt in a real browser (T-98, T-99: AC-45, AC-55, AC-57, AC-59, FR-160,
 * FR-161). Runs on the shipped lists.
 *
 * A real game draws a random seed, so a test that needs a known puzzle saves
 * one. Its word list is worked out here from the shipped lists the same way
 * the game does it: the common words (answers and shuffle list) of 4, 5 and 6
 * letters that can be spelled from the seed. A saved puzzle carries its own
 * words, so that is also the path a reload takes (FR-164).
 */

const HUNT_URL = '/#/hunt';
const LISTS = { 4: lists4, 5: lists5, 6: lists6 } as const;
type Length = keyof typeof LISTS;

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const slots = (page: Page) => page.getByRole('group', { name: 'Words to find' });
const tray = (page: Page) => page.getByRole('group', { name: 'Letter tray' });
const foundLine = (page: Page) => page.locator('main p').filter({ hasText: /of \d+ found/ });
async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

function formable(word: string, letters: string): boolean {
  const left = [...letters];
  for (const letter of word) {
    const at = left.indexOf(letter);
    if (at === -1) return false;
    left.splice(at, 1);
  }
  return true;
}

function commonOf(length: Length): Set<string> {
  return new Set([...LISTS[length].answers, ...(LISTS[length].shuffle ?? [])]);
}

/** The common words that can be made from the seed, shortest first and alphabetical. */
function requiredFor(seed: string): string[] {
  return ([4, 5, 6] as const).flatMap((length) =>
    [...commonOf(length)].filter((word) => formable(word, seed)).sort(),
  );
}

/** Real words made from the seed that are not common, so they are bonus words. */
function bonusFor(seed: string): string[] {
  const common = commonOf(4);
  return LISTS[4].guesses.filter((word) => !common.has(word) && formable(word, seed));
}

/** The seed that hides the most common words, within the puzzle limits of 8 to 20. */
function richestSeed(): string {
  const seeds = [...commonOf(6)].sort();
  let best = 'STAPLE';
  let bestCount = 0;
  for (const seed of seeds) {
    const count = requiredFor(seed).length;
    if (count >= 8 && count <= 20 && count > bestCount) {
      best = seed;
      bestCount = count;
    }
  }
  return best;
}

interface SeedOptions {
  seed?: string;
  /** How many required words to mark as found, from the start of the list. */
  foundCount?: number;
  /** Bonus words to mark as found. */
  bonusCount?: number;
  status?: 'playing' | 'won' | 'gave-up';
  typed?: string;
}

/** Saves a WordHunt puzzle, with a word list worked out from the real lists, before the page loads. */
async function seedGame(page: Page, options: SeedOptions = {}): Promise<string[]> {
  const {
    seed = 'STAPLE',
    foundCount = 0,
    bonusCount = 0,
    status = 'playing',
    typed = '',
  } = options;
  const required = requiredFor(seed);
  const found = status === 'won' ? required : required.slice(0, foundCount);
  const session = {
    id: 'e2e-game',
    seed,
    tray: [...seed].reverse().join(''),
    required,
    found,
    bonus: bonusFor(seed).slice(0, bonusCount),
    currentInput: status === 'playing' ? typed : '',
    status,
    startedAt: 1,
    finishedAt: status === 'playing' ? null : 2,
  };
  await page.addInitScript((value: string) => {
    // Seed once, so a reload inside a test keeps the game it has built.
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('wordgames:v1:hunt:session', value);
      sessionStorage.setItem('seeded', '1');
    }
  }, JSON.stringify(session));
  return required;
}

async function openHunt(page: Page): Promise<void> {
  await page.goto(HUNT_URL);
  await expect(slots(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
}

/** Types a word and submits it. */
async function submit(page: Page, word: string): Promise<void> {
  await page.keyboard.type(word.toLowerCase());
  await page.keyboard.press('Enter');
}

// Reduced motion keeps dialogs from fading while axe reads colours.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('opening and navigating (AC-45)', () => {
  test('Home has a WordHunt card in catalogue order, and it opens the game', async ({ page }) => {
    await page.goto('/');

    const links = page.getByRole('list').getByRole('link');
    await expect(links).toHaveCount(8);
    await expect(links.nth(7)).toHaveAccessibleName('Play WordHunt');

    await page.getByRole('link', { name: 'Play WordHunt' }).click();

    await expect(page).toHaveURL(/#\/hunt$/);
    await expect(heading(page)).toHaveText('WordHunt');
    await expect(heading(page)).toBeFocused();
    await expect(page).toHaveTitle('WordHunt · WordGames');
  });
});

test.describe('the shipped lists (AC-59)', () => {
  test('STAPLE hides common words of every length, and enough of them', () => {
    const words = requiredFor('STAPLE');

    expect(words.length).toBeGreaterThanOrEqual(8);
    expect(words.some((word) => word.length === 4)).toBe(true);
    expect(words).toContain('STAPLE');
  });
});

test.describe('playing (FR-160, FR-161, AC-59)', () => {
  test('a real puzzle opens with six tray letters, empty slots and a clock at 0:00', async ({
    page,
  }) => {
    await openHunt(page);

    await expect(tray(page).getByRole('button')).toHaveCount(6);
    await expect(foundLine(page)).toContainText('0 of');
    await expect(page.getByRole('timer', { name: 'Time' })).toHaveText('0:00');
    await expect(page.getByRole('radio')).toHaveCount(0);
  });

  test('a common word fills its slot, and a bonus word is listed apart', async ({ page }) => {
    const required = await seedGame(page);
    await openHunt(page);

    await submit(page, required[0] as string);
    await expect(slots(page).getByLabel(required[0] as string)).toBeVisible();
    await expect(foundLine(page)).toContainText(`1 of ${String(required.length)} found`);

    const bonus = bonusFor('STAPLE')[0] as string;
    await submit(page, bonus);
    await expect(page.getByText(/Bonus words \(1\)/)).toBeVisible();
    await expect(foundLine(page)).toContainText(`1 of ${String(required.length)} found`);
  });

  test('tapping tray letters builds a word like typing does', async ({ page }) => {
    await seedGame(page);
    await openHunt(page);

    await tray(page).getByRole('button', { name: 'P', exact: true }).click();
    await tray(page).getByRole('button', { name: 'A', exact: true }).click();

    await expect(page.getByRole('group', { name: 'Your word: PA' })).toBeVisible();
    await expect(tray(page).getByRole('button', { name: 'P, used' })).toBeDisabled();
  });

  test('a short word is refused with a toast, and a letter not in the tray is ignored', async ({
    page,
  }) => {
    await seedGame(page);
    await openHunt(page);

    await page.keyboard.type('zq');
    await expect(page.getByRole('group', { name: 'Your word: empty' })).toBeVisible();

    await page.keyboard.type('pa');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Not enough letters');
  });

  test('finding every word wins; the next Enter starts a new puzzle (AC-55)', async ({ page }) => {
    const required = await seedGame(page, { foundCount: requiredFor('STAPLE').length - 1 });
    await openHunt(page);

    await submit(page, required[required.length - 1] as string);

    await expect(page.getByRole('heading', { name: 'Every word found!' })).toBeVisible();
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'Every word found!' })).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Every word found!' })).toBeHidden();
    await expect(foundLine(page)).toContainText('0 of');
  });

  test('Give up asks first, then shows the missed words', async ({ page }) => {
    await seedGame(page, { foundCount: 2 });
    await openHunt(page);

    await page.getByRole('button', { name: 'Give up', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Give up' }).click();

    await expect(page.getByRole('heading', { name: 'Gave up' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Gave up' })).toContainText('Words you missed');
  });

  test('a puzzle survives a reload with its words and a typed letter (FR-164)', async ({
    page,
  }) => {
    await seedGame(page, { foundCount: 2, bonusCount: 1 });
    await openHunt(page);
    await page.keyboard.type('s');
    await page.waitForTimeout(300);
    const before = await foundLine(page).textContent();

    await page.reload();

    await expect(foundLine(page)).toHaveText(before ?? '');
    await expect(page.getByText(/Bonus words \(1\)/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Your word: S' })).toBeVisible();
  });

  test('Reshuffle reorders the tray and keeps its letters', async ({ page }) => {
    await seedGame(page);
    await openHunt(page);
    const letters = async () => (await tray(page).getByRole('button').allTextContents()).join('');
    const before = await letters();

    await page.getByRole('button', { name: 'Reshuffle' }).click();

    await expect.poll(letters).not.toBe(before);
    expect([...(await letters())].sort().join('')).toBe([...before].sort().join(''));
  });
});

test.describe('accessibility (AC-57)', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const palette of ['default', 'colourblind'] as const) {
      test(`has no violations in ${colorScheme} with the ${palette} palette`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.addInitScript((colourblind: boolean) => {
          localStorage.setItem(
            'wordgames:v1:settings',
            JSON.stringify({ theme: 'system', colorblind: colourblind, motion: 'reduced' }),
          );
        }, palette === 'colourblind');
        // Found words, a bonus word and typed letters.
        await seedGame(page, { foundCount: 4, bonusCount: 2, typed: 'SP' });
        await openHunt(page);
        await page.waitForTimeout(200);

        expect((await scan(page)).violations).toEqual([]);
      });
    }
  }

  test('the help dialog has no violations', async ({ page }) => {
    await openHunt(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the statistics dialog has no violations, empty and with puzzles', async ({ page }) => {
    await openHunt(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.keyboard.press('Escape');

    const required = requiredFor('STAPLE');
    await page.evaluate(() => {
      localStorage.removeItem('wordgames:v1:hunt:session');
    });
    await seedGame(page, { foundCount: required.length - 1 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
    await submit(page, required[required.length - 1] as string);
    await expect(page.getByRole('heading', { name: 'Every word found!' })).toBeVisible();
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toContainText('STAPLE');

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the result panel has no violations, after a win', async ({ page }) => {
    await seedGame(page, { status: 'won', bonusCount: 2 });
    await page.goto(HUNT_URL);

    await expect(page.getByRole('heading', { name: 'Every word found!' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the give up panel and its missed words have no violations', async ({ page }) => {
    await seedGame(page, { status: 'gave-up', foundCount: 3 });
    await page.goto(HUNT_URL);

    await expect(page.getByRole('heading', { name: 'Gave up' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the confirmation dialogs have no violations', async ({ page }) => {
    await seedGame(page, { foundCount: 1 });
    await openHunt(page);
    await page.getByRole('button', { name: 'New puzzle' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Give up', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe('layout (FR-160, FR-59, AC-22)', () => {
  const VIEWPORTS = [
    { name: '320 x 568', width: 320, height: 568 },
    { name: '375 x 667', width: 375, height: 667 },
    { name: '768 x 1024', width: 768, height: 1024 },
    { name: '2560 x 1440', width: 2560, height: 1440 },
    { name: '740 x 360 landscape', width: 740, height: 360 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`the richest puzzle at ${viewport.name}: tray and buttons in view, no horizontal scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedGame(page, { seed: richestSeed(), foundCount: 3, bonusCount: 3, typed: 'SP' });
      await openHunt(page);

      await expect(page.getByRole('button', { name: 'Submit' })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Give up', exact: true })).toBeInViewport();
      await expect(tray(page).getByRole('button').first()).toBeInViewport();
      await expect(slots(page)).toBeInViewport({ ratio: 0.1 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('buttons and tray letters are at least 44 px', async ({ page }) => {
    await seedGame(page);
    await openHunt(page);

    for (const name of ['Backspace', 'Submit', 'Reshuffle', 'Give up']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const letter of await tray(page).getByRole('button').all()) {
      const box = await letter.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['How to play', 'New puzzle', 'Statistics', 'Settings']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
