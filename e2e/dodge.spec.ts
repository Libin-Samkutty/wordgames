import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import * as lists4 from '../src/dictionary/data/lists-4';
import * as lists5 from '../src/dictionary/data/lists-5';
import * as lists6 from '../src/dictionary/data/lists-6';
import { chooseReply, isAllCorrect } from '../src/engine/dodge/adversary';

/**
 * WordDodge in a real browser (T-94, T-95: AC-45, AC-55, AC-57, AC-58, FR-149,
 * FR-150). Runs on the shipped lists.
 *
 * The game draws no secret, so a test that needs a game part-way through saves
 * one. Its replies come from the same adversary the game uses, replayed here
 * against the real answers. That is also the path a reload takes (FR-153), so it
 * exercises restore.
 */

const DODGE_URL = '/#/dodge';
const LISTS = { 4: lists4, 5: lists5, 6: lists6 } as const;
type Length = keyof typeof LISTS;

const OPENERS: Record<Length, string[]> = {
  4: ['BALM', 'SLOT', 'TEND', 'CRAB', 'MUSK', 'LAMP', 'SLAB', 'PLUM'],
  5: ['SLATE', 'CRANE', 'MUSIC', 'PLANT', 'FIGHT', 'SLOTH', 'PANEL', 'STORM'],
  6: ['TANGLE', 'PLANTS', 'WINDOW', 'SILVER', 'GARDEN', 'BRIDGE', 'PLANET', 'SHADOW'],
};

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const board = (page: Page) => page.getByRole('grid', { name: 'Guess board' });
const keyboard = (page: Page) => page.getByLabel('Keyboard');
/** Rows that hold a scored guess, not the one being typed. */
const scoredRows = (page: Page) =>
  board(page)
    .getByRole('row')
    .filter({ has: page.getByRole('gridcell', { name: /position|not in word/ }) });
const wordsLeft = (page: Page) => page.locator('main p').filter({ hasText: /words? left/ });
async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

/** The words a sensible player guesses to win, with the adversary playing against them. */
function winningWords(length: Length): string[] {
  let candidates = [...LISTS[length].answers];
  const words: string[] = [];

  for (;;) {
    let best = candidates[0] as string;
    let bestSize = Infinity;
    for (const word of candidates.slice(0, 40)) {
      const size = chooseReply(word, candidates).candidates.length;
      if (size < bestSize) {
        best = word;
        bestSize = size;
      }
    }
    words.push(best);
    const reply = chooseReply(best, candidates);
    if (isAllCorrect(reply.evaluation)) return words;
    candidates = [...reply.candidates];
  }
}

interface SeedOptions {
  length?: Length;
  words?: string[];
  status?: 'playing' | 'won' | 'gave-up';
  typed?: string;
}

/** Saves a WordDodge game, with replies the adversary would really have given, before the page loads. */
async function seedGame(page: Page, options: SeedOptions = {}): Promise<void> {
  const { length = 5, words = [], status = 'playing', typed = '' } = options;
  const guessSet = new Set(LISTS[length].guesses);
  let candidates = [...LISTS[length].answers];
  const guesses = words.map((word) => {
    if (!guessSet.has(word)) throw new Error(`${word} is not a ${String(length)}-letter guess`);
    const reply = chooseReply(word, candidates);
    candidates = [...reply.candidates];
    return { word, evaluation: reply.evaluation };
  });

  const session = {
    id: 'e2e-game',
    wordLength: length,
    guesses,
    currentInput: status === 'playing' ? typed : '',
    status,
    startedAt: 1,
    finishedAt: status === 'playing' ? null : 2,
  };
  await page.addInitScript(
    ([value, len]: [string, number]) => {
      localStorage.setItem('wordgames:v1:dodge:prefs', JSON.stringify({ defaultWordLength: len }));
      // Seed once, so a reload inside a test keeps the game it has built.
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('wordgames:v1:dodge:session', value);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [JSON.stringify(session), length] as [string, number],
  );
}

async function openDodge(page: Page): Promise<void> {
  await page.goto(DODGE_URL);
  await expect(board(page)).toBeVisible();
  // The dictionary has loaded once typing is allowed.
  await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
}

/** Submits a word and waits until `total` guesses are scored, so it never races the state update. */
async function guess(page: Page, word: string, total: number): Promise<void> {
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
  await expect(scoredRows(page)).toHaveCount(total, { timeout: 3000 });
  // The reveal is over once input is open again, or the game has ended, so the next word is not dropped.
  await expect
    .poll(async () => {
      const open = await page.getByRole('button', { name: 'Enter' }).isEnabled();
      const ended = (await page.getByRole('heading', { name: /cornered|Gave up/ }).count()) > 0;
      return open || ended;
    })
    .toBe(true);
}

// Reduced motion keeps dialogs from fading while axe reads colours.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('opening and navigating (AC-45)', () => {
  test('Home has a WordDodge card in catalogue order, and it opens the game', async ({ page }) => {
    await page.goto('/');

    const links = page.getByRole('list').getByRole('link');
    await expect(links).toHaveCount(9);
    await expect(links.nth(6)).toHaveAccessibleName('Play WordDodge');

    await page.getByRole('link', { name: 'Play WordDodge' }).click();

    await expect(page).toHaveURL(/#\/dodge$/);
    await expect(heading(page)).toHaveText('WordDodge');
    await expect(heading(page)).toBeFocused();
    await expect(page).toHaveTitle('WordDodge · WordGames');
  });
});

test.describe('playing (FR-149, FR-150, AC-58)', () => {
  test('a real game opens with one empty row, 26 letter keys, 700 words and 5 letters', async ({
    page,
  }) => {
    await openDodge(page);

    await expect(board(page).getByRole('row')).toHaveCount(1);
    await expect(keyboard(page).getByRole('button')).toHaveCount(26 + 2);
    await expect(wordsLeft(page)).toHaveText('700 words left');
    await expect(page.getByRole('radio', { name: /^5/ })).toBeChecked();
  });

  test('a guess is coloured, the board grows and the count falls', async ({ page }) => {
    await openDodge(page);

    await guess(page, 'slate', 1);

    await expect(board(page).getByRole('row')).toHaveCount(2);
    await expect(
      scoredRows(page)
        .first()
        .getByRole('gridcell', { name: /position|not in word/ }),
    ).toHaveCount(5);
    await expect(wordsLeft(page)).not.toContainText('700');
  });

  test('a rejected guess costs nothing, and a repeat is allowed', async ({ page }) => {
    await openDodge(page);

    await page.keyboard.type('zzzzz');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Not in word list');
    await expect(scoredRows(page)).toHaveCount(0);
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Backspace');

    await guess(page, 'slate', 1);
    await guess(page, 'slate', 2);
  });

  test('narrowing the words to one and guessing it wins; the next Enter starts a new game (AC-55)', async ({
    page,
  }) => {
    const words = winningWords(5);
    await seedGame(page, { words: words.slice(0, -1) });
    await openDodge(page);

    await guess(page, words[words.length - 1] as string, words.length);

    await expect(page.getByRole('heading', { name: 'You cornered it!' })).toBeVisible();
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'You cornered it!' })).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'You cornered it!' })).toBeHidden();
    await expect(scoredRows(page)).toHaveCount(0);
  });

  test('Give up asks first, then shows a word that was still possible', async ({ page }) => {
    await seedGame(page, { words: ['SLATE', 'CRANE'] });
    await openDodge(page);

    await page.getByRole('button', { name: 'Give up', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Give up' }).click();

    await expect(page.getByRole('heading', { name: 'Gave up' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Gave up' })).toContainText('It could have been');
  });

  test('switching length after a guess asks, and Switch opens the new length', async ({ page }) => {
    await seedGame(page);
    await openDodge(page);
    await guess(page, 'slate', 1);

    await page.getByRole('radio', { name: /^4/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Switch' }).click();

    await expect(page.getByRole('radio', { name: /^4/ })).toBeChecked();
    await expect(board(page).getByRole('row').first().getByRole('gridcell')).toHaveCount(4);
  });

  test('a game survives a reload with its rows, its count and a typed letter (FR-153)', async ({
    page,
  }) => {
    await seedGame(page, { words: ['SLATE', 'CRANE'] });
    await openDodge(page);
    const before = await wordsLeft(page).textContent();
    await page.keyboard.type('mu');
    await page.waitForTimeout(300);

    await page.reload();

    await expect(scoredRows(page)).toHaveCount(2);
    await expect(wordsLeft(page)).toHaveText(before ?? '');
    await expect(page.getByRole('gridcell', { name: 'Row 3, letter 1: M, entered' })).toBeVisible();
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
        // Guesses of every colour on the board and the keys, and typed letters.
        await seedGame(page, { words: ['SLATE', 'CRANE', 'MUSIC'], typed: 'SL' });
        await openDodge(page);
        await page.waitForTimeout(200);

        expect((await scan(page)).violations).toEqual([]);
      });
    }
  }

  for (const length of [4, 6] as const) {
    test(`a ${String(length)}-letter game has no violations`, async ({ page }) => {
      await seedGame(page, { length, words: [length === 4 ? 'BALM' : 'TANGLE'] });
      await openDodge(page);

      expect((await scan(page)).violations).toEqual([]);
    });
  }

  test('the help dialog has no violations', async ({ page }) => {
    await openDodge(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the statistics dialog has no violations, empty and with games', async ({ page }) => {
    await openDodge(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.keyboard.press('Escape');

    const words = winningWords(5);
    await page.evaluate(() => {
      localStorage.removeItem('wordgames:v1:dodge:session');
    });
    await seedGame(page, { words: words.slice(0, -1) });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
    await guess(page, words[words.length - 1] as string, words.length);
    await expect(page.getByRole('heading', { name: 'You cornered it!' })).toBeVisible();
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toContainText(words[words.length - 1] as string);

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the result panel has no violations, after a win and after a give up', async ({ page }) => {
    await seedGame(page, { words: winningWords(5), status: 'won' });
    await page.goto(DODGE_URL);

    await expect(page.getByRole('heading', { name: 'You cornered it!' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the give up panel has no violations', async ({ page }) => {
    await seedGame(page, { words: ['SLATE', 'CRANE'], status: 'gave-up' });
    await page.goto(DODGE_URL);

    await expect(page.getByRole('heading', { name: 'Gave up' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the confirmation dialogs have no violations', async ({ page }) => {
    await seedGame(page, { words: ['SLATE'] });
    await openDodge(page);
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Give up', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe('layout (FR-150, FR-59, AC-22)', () => {
  const VIEWPORTS = [
    { name: '320 x 568', width: 320, height: 568 },
    { name: '375 x 667', width: 375, height: 667 },
    { name: '768 x 1024', width: 768, height: 1024 },
    { name: '2560 x 1440', width: 2560, height: 1440 },
    { name: '740 x 360 landscape', width: 740, height: 360 },
  ];

  for (const length of [4, 6] as const) {
    for (const viewport of VIEWPORTS) {
      test(`${String(length)} letters at ${viewport.name}: keyboard in view, no horizontal scroll with eight guesses`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await seedGame(page, { length, words: OPENERS[length] });
        await openDodge(page);

        await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
        await expect(page.getByRole('group', { name: 'Board' })).toBeInViewport({ ratio: 0.1 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }

  test('the newest row stays in view as the board grows', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedGame(page, { words: OPENERS[5], typed: 'MU' });
    await openDodge(page);

    await expect(
      page.getByRole('gridcell', { name: 'Row 9, letter 1: M, entered' }),
    ).toBeInViewport();
  });

  test('buttons and keys are at least 44 px', async ({ page }) => {
    await seedGame(page, { words: ['SLATE'] });
    await openDodge(page);

    for (const name of ['Enter', 'Backspace']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const key = await keyboard(page).getByRole('button', { name: 'Q', exact: true }).boundingBox();
    expect(key?.height ?? 0).toBeGreaterThanOrEqual(44);
    const giveUp = await page.getByRole('button', { name: 'Give up', exact: true }).boundingBox();
    expect(giveUp?.height ?? 0).toBeGreaterThanOrEqual(44);
    for (const name of ['How to play', 'New game', 'Statistics', 'Settings']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const radio of await page.getByRole('radio').all()) {
      const box = await radio.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
