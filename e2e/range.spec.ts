import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WordRange in a real browser (T-82, T-83: AC-45, AC-49, AC-50, AC-57, FR-121,
 * NFR-21). Runs on the shipped lists, 5 letters by default.
 *
 * The secret is random in a real game, so tests that need a known word seed a
 * saved game with the secret PLANT (a real answer). That is the same path a
 * reload takes (FR-125), so it also exercises restore.
 */

const RANGE_URL = '/#/range';
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const guessRow = (page: Page) => page.getByRole('group', { name: /^Your guess/ });
const guessesLeft = (page: Page, count: number) =>
  page.getByText(`${String(count)} ${count === 1 ? 'guess' : 'guesses'} left`, { exact: true });

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

interface SeedGuess {
  word: string;
  direction: 'before' | 'after' | null;
  heat: string | null;
}

/** Saves a WordRange game with the secret PLANT before the page loads. */
async function seedGame(
  page: Page,
  guesses: SeedGuess[] = [],
  status: 'playing' | 'won' = 'playing',
): Promise<void> {
  const after = guesses.filter((g) => g.direction === 'after').map((g) => g.word);
  const before = guesses.filter((g) => g.direction === 'before').map((g) => g.word);
  const session = {
    id: 'e2e-game',
    secret: 'PLANT',
    guesses,
    lower: after.length > 0 ? [...after].sort().at(-1) : 'AAAAA',
    upper: before.length > 0 ? [...before].sort()[0] : 'ZZZZZ',
    currentInput: '',
    status,
    startedAt: 1,
    finishedAt: status === 'won' ? 2 : null,
  };
  await page.addInitScript((value: string) => {
    // Seed once, so a reload inside a test keeps the game it has built.
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('wordgames:v1:range:session', value);
      sessionStorage.setItem('seeded', '1');
    }
  }, JSON.stringify(session));
}

async function openRange(page: Page): Promise<void> {
  await page.goto(RANGE_URL);
  await expect(guessRow(page)).toBeVisible();
  // The dictionary has loaded once the board is there and typing is allowed.
  await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
}

/** Submits a word and waits for the guess count to drop, so it never races the state update. */
async function guess(page: Page, word: string, countAfter: number): Promise<void> {
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
  await expect(guessesLeft(page, countAfter)).toBeVisible({ timeout: 3000 });
}

const FREEZING_AFTER: SeedGuess = { word: 'BRAVE', direction: 'after', heat: 'freezing' };

// Reduced motion keeps dialogs from fading while axe reads colours.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('opening and navigating (AC-45)', () => {
  test('Home has a WordRange card in catalogue order, and it opens the game', async ({ page }) => {
    await page.goto('/');

    const links = page.getByRole('list').getByRole('link');
    await expect(links).toHaveCount(6);
    await expect(links.nth(3)).toHaveAccessibleName('Play WordRange');

    await page.getByRole('link', { name: 'Play WordRange' }).click();

    await expect(page).toHaveURL(/#\/range$/);
    await expect(heading(page)).toHaveText('WordRange');
    await expect(heading(page)).toBeFocused();
    await expect(page).toHaveTitle('WordRange · WordGames');
  });

  test('a game that has not shipped goes Home', async ({ page }) => {
    await page.goto('/#/hangman');

    await expect(heading(page)).toHaveText('WordGames');
    await expect(page).toHaveURL(/#\/$/);
  });
});

test.describe('playing (FR-117, FR-118, FR-121, AC-49, AC-50)', () => {
  test('a real game starts at the sentinels with 14 guesses', async ({ page }) => {
    await openRange(page);

    await expect(page.getByText('The word comes before').locator('+ span')).toHaveText('ZZZZZ');
    await expect(page.getByText('The word comes after').locator('+ span')).toHaveText('AAAAA');
    await expect(guessesLeft(page, 14)).toBeVisible();
  });

  for (const [length, guesses, upper, lower] of [
    [4, 13, 'ZZZZ', 'AAAA'],
    [6, 15, 'ZZZZZZ', 'AAAAAA'],
  ] as const) {
    test(`a ${String(length)}-letter game has ${String(guesses)} guesses and its own sentinels (ADR-037)`, async ({
      page,
    }) => {
      await openRange(page);

      await page.getByRole('radio', { name: `${String(length)} letters` }).click();

      await expect(page.getByText('The word comes before').locator('+ span')).toHaveText(upper);
      await expect(page.getByText('The word comes after').locator('+ span')).toHaveText(lower);
      await expect(guessesLeft(page, guesses)).toBeVisible();

      await page.keyboard.type('abcdefghij');
      await expect(
        page.getByRole('group', { name: `Your guess: ${'ABCDEFGHIJ'.slice(0, length)}` }),
      ).toBeVisible();
    });
  }

  test('the chosen length survives a reload (FR-125)', async ({ page }) => {
    await openRange(page);
    await page.getByRole('radio', { name: '6 letters' }).click();
    await expect(guessesLeft(page, 15)).toBeVisible();

    await page.reload();
    await expect(guessRow(page)).toBeVisible();

    await expect(page.getByRole('radio', { name: '6 letters' })).toBeChecked();
    await expect(guessesLeft(page, 15)).toBeVisible();
  });

  test('guesses narrow the range, show a heat word, and a rejected guess costs nothing', async ({
    page,
  }) => {
    await seedGame(page);
    await openRange(page);

    await guess(page, 'crane', 13);
    await guess(page, 'mango', 12);

    // MANGO and CRANE come before PLANT, so both say "After" and the lower bound is MANGO.
    await expect(page.getByText('The word comes after').locator('+ span')).toHaveText('MANGO');
    const list = page.getByRole('list', { name: 'Your guesses, in alphabetical order' });
    const items = list.getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('CRANE');
    await expect(items.nth(1)).toContainText('MANGO');
    await expect(items.nth(1)).toContainText('After');
    await expect(items.nth(1)).toContainText(/Burning|Hot|Warm|Cold|Freezing/);

    // A repeat is rejected and costs no guess.
    await page.keyboard.type('mango');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Already guessed');
    await expect(guessesLeft(page, 12)).toBeVisible();
  });

  test('a word outside the range is rejected and costs no guess (AC-50)', async ({ page }) => {
    await seedGame(page, [
      { word: 'CRANE', direction: 'after', heat: 'freezing' },
      { word: 'STORM', direction: 'before', heat: 'freezing' },
    ]);
    await openRange(page);

    await page.keyboard.type('abbey');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('alert')).toHaveText('Outside the range');
    await expect(guessesLeft(page, 12)).toBeVisible();
    await expect(guessRow(page)).toHaveAccessibleName('Your guess: ABBEY');
  });

  test('finding the word shows the result, and the next Enter starts a new game (AC-55)', async ({
    page,
  }) => {
    await seedGame(page);
    await openRange(page);

    await guess(page, 'plant', 13);

    await expect(page.getByRole('heading', { name: 'You found it!' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'You found it!' })).toContainText('PLANT');
    // The Enter that submitted the word did not start a new game.
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'You found it!' })).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'You found it!' })).toBeHidden();
    await expect(guessesLeft(page, 14)).toBeVisible();
  });

  test('the keyboard never changes colour (FR-122)', async ({ page }) => {
    await seedGame(page);
    await openRange(page);
    await guess(page, 'mango', 13);

    const classes = await page
      .getByLabel('Keyboard')
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((button) => button.className));
    for (const name of classes) expect(name).not.toMatch(/key-(correct|present|absent)/);
  });

  test('reload keeps the range, the guesses and the typed letters (FR-125)', async ({ page }) => {
    await seedGame(page);
    await openRange(page);
    await guess(page, 'mango', 13);
    await page.keyboard.type('pl');
    await page.waitForTimeout(300);

    await page.reload();

    await expect(guessRow(page)).toHaveAccessibleName('Your guess: PL');
    await expect(
      page.getByRole('list', { name: 'Your guesses, in alphabetical order' }),
    ).toContainText('MANGO');
    await expect(guessesLeft(page, 13)).toBeVisible();
  });

  test('Home → WordRange → a guess → All games → Home, with the keyboard only', async ({
    page,
  }) => {
    await seedGame(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Play WordRange' }).focus();
    await page.keyboard.press('Enter');
    await expect(guessRow(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
    await guess(page, 'mango', 13);

    await page.getByRole('link', { name: 'All games' }).focus();
    await page.keyboard.press('Enter');

    await expect(heading(page)).toHaveText('WordGames');
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
        await seedGame(page);
        await openRange(page);
        // Played guesses and typed letters, so the list and the input row are on screen.
        await guess(page, 'crane', 13);
        await guess(page, 'sorry', 12);
        await page.keyboard.type('pl');
        await page.waitForTimeout(200);

        expect((await scan(page)).violations).toEqual([]);
      });
    }
  }

  test('every heat level, both directions and the found row have no violations', async ({
    page,
  }) => {
    await seedGame(page, [
      { word: 'ABOUT', direction: 'after', heat: 'freezing' },
      { word: 'CRANE', direction: 'after', heat: 'freezing' },
      { word: 'MOUND', direction: 'after', heat: 'cold' },
      { word: 'PANEL', direction: 'after', heat: 'warm' },
      { word: 'PLUMB', direction: 'before', heat: 'hot' },
      { word: 'PLAIN', direction: 'after', heat: 'burning' },
    ]);
    await openRange(page);

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the help dialog has no violations', async ({ page }) => {
    await openRange(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the statistics dialog has no violations, empty and with games', async ({ page }) => {
    await openRange(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.keyboard.press('Escape');

    // Win a seeded game, so the dialog shows a played game.
    await page.evaluate(() => {
      localStorage.removeItem('wordgames:v1:range:session');
    });
    await seedGame(page);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
    await guess(page, 'plant', 13);
    await expect(page.getByRole('heading', { name: 'You found it!' })).toBeVisible();
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toContainText('PLANT');

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the result panel has no violations', async ({ page }) => {
    await seedGame(page, [FREEZING_AFTER, { word: 'PLANT', direction: null, heat: null }], 'won');
    await page.goto(RANGE_URL);

    await expect(page.getByRole('heading', { name: 'You found it!' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the confirmation dialog has no violations', async ({ page }) => {
    await seedGame(page);
    await openRange(page);
    await guess(page, 'mango', 13);
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe('layout (FR-121, FR-59, AC-22)', () => {
  const VIEWPORTS = [
    { name: '320 x 568', width: 320, height: 568 },
    { name: '375 x 667', width: 375, height: 667 },
    { name: '768 x 1024', width: 768, height: 1024 },
    { name: '2560 x 1440', width: 2560, height: 1440 },
    { name: '740 x 360 landscape', width: 740, height: 360 },
  ];

  /** Thirteen guesses, so the list is as long as it can get without ending the game. */
  const MANY: SeedGuess[] = [
    'ABBEY',
    'ABOUT',
    'ADIEU',
    'AGENT',
    'ALARM',
    'BLAZE',
    'BRAVE',
    'CRANE',
    'DRINK',
    'EAGER',
    'FJORD',
    'GHOST',
    'HOUSE',
  ].map((word) => ({ word, direction: 'after', heat: 'freezing' }));

  for (const viewport of VIEWPORTS) {
    test(`at ${viewport.name}: keyboard in view, no horizontal scroll, with 13 guesses`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedGame(page, MANY);
      await openRange(page);

      await expect(guessesLeft(page, 1)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
      await expect(page.getByRole('group', { name: 'Range' })).toBeInViewport({ ratio: 0.1 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('a 6-letter game fits at 320 x 568 with the length picker in the header', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openRange(page);
    await page.getByRole('radio', { name: '6 letters' }).click();
    await expect(guessesLeft(page, 15)).toBeVisible();

    await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the list scrolls inside its own region, not the page, at 320 x 568', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedGame(page, MANY);
    await openRange(page);

    const scrolls = await page.evaluate(() => {
      const area = document.querySelector('[aria-label="Range"]') as HTMLElement;
      return area.scrollHeight > area.clientHeight;
    });
    expect(scrolls).toBe(true);
  });

  test('buttons and keys are at least 44 px', async ({ page }) => {
    await openRange(page);

    for (const name of ['Enter', 'Backspace']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const key = await page.getByRole('button', { name: 'Q', exact: true }).boundingBox();
    expect(key?.height ?? 0).toBeGreaterThanOrEqual(44);
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
