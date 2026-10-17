import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { scoreCode } from '../src/engine/code/score';

/**
 * WordCode in a real browser (T-86, T-87: AC-45, AC-51, AC-52, AC-57, FR-131,
 * FR-132). Runs on the shipped lists.
 *
 * The secret is random in a real game, so tests that need a known word seed a
 * saved game whose secret is a real answer: LAMB, PLANT or PLANET. That is the
 * same path a reload takes (FR-135), so it also exercises restore.
 */

const CODE_URL = '/#/code';
const SECRETS = { 4: 'LAMB', 5: 'PLANT', 6: 'PLANET' } as const;
type Length = keyof typeof SECRETS;

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const rowsList = (page: Page) => page.getByRole('list', { name: 'Guesses' });
const keyboard = (page: Page) => page.getByLabel('Keyboard');
const noteButton = (page: Page, letter: string) =>
  keyboard(page).getByRole('button', { name: new RegExp(`^${letter}(,|$)`) });
/** Switches the keyboard to Mark mode, where a letter key cycles its note. */
const markMode = (page: Page) => page.getByRole('button', { name: 'Mark' }).click();
async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

interface SeedOptions {
  length?: Length;
  words?: string[];
  notes?: Record<string, 'out' | 'in'>;
  status?: 'playing' | 'won';
}

/** Saves a WordCode game with a real secret before the page loads. */
async function seedGame(page: Page, options: SeedOptions = {}): Promise<void> {
  const { length = 5, words = [], notes = {}, status = 'playing' } = options;
  const secret = SECRETS[length];
  const session = {
    id: 'e2e-game',
    wordLength: length,
    secret,
    guesses: words.map((word) => ({ word, ...scoreCode(word, secret) })),
    currentInput: '',
    notes,
    status,
    startedAt: 1,
    finishedAt: status === 'won' ? 2 : null,
  };
  await page.addInitScript(
    ([value, len]: [string, number]) => {
      localStorage.setItem('wordgames:v1:code:prefs', JSON.stringify({ defaultWordLength: len }));
      // Seed once, so a reload inside a test keeps the game it has built.
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('wordgames:v1:code:session', value);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [JSON.stringify(session), length] as [string, number],
  );
}

async function openCode(page: Page): Promise<void> {
  await page.goto(CODE_URL);
  await expect(rowsList(page)).toBeVisible();
  // The dictionary has loaded once typing is allowed.
  await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
}

/** Submits a word and waits until `total` guess rows are scored, so it never races the state update. */
async function guess(page: Page, word: string, total: number): Promise<void> {
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
  await expect(rowsList(page).getByRole('listitem').filter({ hasText: /bull/ })).toHaveCount(
    total,
    { timeout: 3000 },
  );
}

// Reduced motion keeps dialogs from fading while axe reads colours.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('opening and navigating (AC-45)', () => {
  test('Home has a WordCode card in catalogue order, and it opens the game', async ({ page }) => {
    await page.goto('/');

    const links = page.getByRole('list').getByRole('link');
    await expect(links).toHaveCount(7);
    await expect(links.nth(4)).toHaveAccessibleName('Play WordCode');

    await page.getByRole('link', { name: 'Play WordCode' }).click();

    await expect(page).toHaveURL(/#\/code$/);
    await expect(heading(page)).toHaveText('WordCode');
    await expect(heading(page)).toBeFocused();
    await expect(page).toHaveTitle('WordCode · WordGames');
  });
});

test.describe('playing (FR-129, FR-131, AC-51)', () => {
  test('a real game opens with ten empty rows, 26 letter keys and 5 letters', async ({ page }) => {
    await openCode(page);

    await expect(rowsList(page).getByRole('listitem')).toHaveCount(10);
    await expect(keyboard(page).getByRole('button')).toHaveCount(26 + 2 + 2);
    await expect(page.getByRole('radio', { name: /^5/ })).toBeChecked();
  });

  test('a guess shows its counts as text (AC-51)', async ({ page }) => {
    await seedGame(page);
    await openCode(page);

    await guess(page, 'panel', 1);

    await expect(rowsList(page).getByRole('listitem').first()).toContainText(
      'PANEL: 1 bull · 3 cows',
    );
  });

  test('a rejected guess costs nothing, and a repeat is allowed', async ({ page }) => {
    await seedGame(page);
    await openCode(page);

    await page.keyboard.type('zzzzz');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Not in word list');
    await expect(rowsList(page).getByRole('listitem').filter({ hasText: /bull/ })).toHaveCount(0);
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Backspace');

    await guess(page, 'panel', 1);
    await guess(page, 'panel', 2);
  });

  test('finding the word shows the result, and the next Enter starts a new game (AC-55)', async ({
    page,
  }) => {
    await seedGame(page);
    await openCode(page);

    await guess(page, 'plant', 1);

    await expect(page.getByRole('heading', { name: 'You cracked it!' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'You cracked it!' })).toContainText('PLANT');
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'You cracked it!' })).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'You cracked it!' })).toBeHidden();
    await expect(rowsList(page).getByRole('listitem').filter({ hasText: /bull/ })).toHaveCount(0);
  });

  test('switching length after a guess asks, and Switch opens the new length', async ({ page }) => {
    await seedGame(page);
    await openCode(page);
    await guess(page, 'panel', 1);

    await page.getByRole('radio', { name: /^4/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Switch' }).click();

    await expect(page.getByRole('radio', { name: /^4/ })).toBeChecked();
    await expect(
      rowsList(page).getByRole('listitem').first().locator('[aria-hidden="true"] > span'),
    ).toHaveCount(4);
  });
});

test.describe('letter notes (FR-132, AC-52)', () => {
  test('three presses clear a mark, and the keyboard shows it', async ({ page }) => {
    await openCode(page);
    await markMode(page);

    await noteButton(page, 'P').click();
    await expect(noteButton(page, 'P')).toHaveAccessibleName('P, ruled out');

    await noteButton(page, 'P').click();
    await expect(noteButton(page, 'P')).toHaveAccessibleName('P, in the word');
    await noteButton(page, 'P').click();
    await expect(noteButton(page, 'P')).toHaveAccessibleName('P, unmarked');
  });

  test('marks and rows survive a reload (AC-52)', async ({ page }) => {
    await seedGame(page);
    await openCode(page);
    await markMode(page);
    await noteButton(page, 'Q').click();
    await noteButton(page, 'Z').click();
    await noteButton(page, 'Z').click();
    await guess(page, 'panel', 1);
    await page.keyboard.type('sl');
    await page.waitForTimeout(300);

    await page.reload();

    await expect(noteButton(page, 'Q')).toHaveAccessibleName('Q, ruled out');
    await expect(noteButton(page, 'Z')).toHaveAccessibleName('Z, in the word');
    await expect(
      page.getByLabel('Keyboard').getByRole('button', { name: 'Q, ruled out' }),
    ).toBeVisible();
    await expect(rowsList(page).getByRole('listitem').first()).toContainText('PANEL: 1 bull');
    await expect(page.getByRole('listitem', { name: 'Your guess: SL' })).toBeVisible();
  });

  test('no guess changes a mark', async ({ page }) => {
    await seedGame(page, { notes: { P: 'out' } });
    await openCode(page);

    await guess(page, 'panel', 1);

    await expect(noteButton(page, 'P')).toHaveAccessibleName('P, ruled out');
    await expect(noteButton(page, 'A')).toHaveAccessibleName('A');
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
        // Guesses, both marks on the notes and the keys, and typed letters.
        await seedGame(page, {
          words: ['PANEL', 'SLATE', 'MUSIC'],
          notes: { M: 'out', U: 'out', I: 'out', P: 'in', L: 'in' },
        });
        await openCode(page);
        await page.keyboard.type('sl');
        await page.waitForTimeout(200);

        expect((await scan(page)).violations).toEqual([]);
      });
    }
  }

  for (const length of [4, 6] as const) {
    test(`a ${String(length)}-letter game has no violations`, async ({ page }) => {
      await seedGame(page, { length, words: [length === 4 ? 'BALM' : 'TANGLE'] });
      await openCode(page);

      expect((await scan(page)).violations).toEqual([]);
    });
  }

  test('the help dialog has no violations', async ({ page }) => {
    await openCode(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the statistics dialog has no violations, empty and with games', async ({ page }) => {
    await openCode(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.keyboard.press('Escape');

    await page.evaluate(() => {
      localStorage.removeItem('wordgames:v1:code:session');
    });
    await seedGame(page);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
    await guess(page, 'plant', 1);
    await expect(page.getByRole('heading', { name: 'You cracked it!' })).toBeVisible();
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toContainText('PLANT');

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the result panel has no violations', async ({ page }) => {
    await seedGame(page, { words: ['PANEL', 'PLANT'], status: 'won' });
    await page.goto(CODE_URL);

    await expect(page.getByRole('heading', { name: 'You cracked it!' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the confirmation dialog has no violations', async ({ page }) => {
    await seedGame(page);
    await openCode(page);
    await guess(page, 'panel', 1);
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe('layout (FR-131, FR-59, AC-22)', () => {
  const VIEWPORTS = [
    { name: '320 x 568', width: 320, height: 568 },
    { name: '375 x 667', width: 375, height: 667 },
    { name: '768 x 1024', width: 768, height: 1024 },
    { name: '2560 x 1440', width: 2560, height: 1440 },
    { name: '740 x 360 landscape', width: 740, height: 360 },
  ];

  /** Nine guesses at length 6, the widest and longest the board gets. */
  const MANY = [
    'TANGLE',
    'PLANTS',
    'WINDOW',
    'SILVER',
    'GARDEN',
    'BRIDGE',
    'TANGLE',
    'PLANTS',
    'WINDOW',
  ];

  for (const length of [4, 6] as const) {
    for (const viewport of VIEWPORTS) {
      test(`${String(length)} letters at ${viewport.name}: keyboard in view, no horizontal scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await seedGame(page, {
          length,
          words: MANY.map((word) => (length === 4 ? word.slice(0, 4) : word)),
        });
        await openCode(page);

        await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
        await expect(page.getByRole('group', { name: 'Board' })).toBeInViewport({
          ratio: 0.1,
        });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        // The counts are not clipped by the row.
        const clipped = await page.evaluate(() => {
          const list = document.querySelector('ol[aria-label="Guesses"]') as HTMLElement;
          return [...list.querySelectorAll('li')].some((li) => li.scrollWidth > li.clientWidth);
        });
        expect(clipped).toBe(false);
      });
    }
  }

  test('buttons and keys are at least 44 px', async ({ page }) => {
    await openCode(page);

    for (const name of ['Enter', 'Backspace']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const key = await page
      .getByLabel('Keyboard')
      .getByRole('button', { name: 'Q', exact: true })
      .boundingBox();
    expect(key?.height ?? 0).toBeGreaterThanOrEqual(44);
    for (const name of ['Type', 'Mark']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['How to play', 'New game', 'Statistics', 'Settings']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
