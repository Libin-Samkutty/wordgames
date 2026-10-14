import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WordShuffle in a real browser (T-90, T-91: AC-45, AC-53, AC-54, AC-57,
 * FR-139, FR-142, FR-145). Runs on the shipped lists.
 *
 * The target is random in a real game, so tests that need a known word seed a
 * saved puzzle whose target is a real answer: LAMB, PLANT or LISTEN. That is the
 * same path a reload takes (FR-147), so it also exercises restore.
 */

const SHUFFLE_URL = '/#/shuffle';
const TARGETS = { 4: 'LAMB', 5: 'PLANT', 6: 'LISTEN' } as const;
/** Each length's scramble: not a word, with the target's letters. */
const SCRAMBLES = { 4: 'ABLM', 5: 'ALNPT', 6: 'EILNST' } as const;
type Length = keyof typeof TARGETS;

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const answerRow = (page: Page) => page.getByRole('group', { name: /^Your answer/ });
const trayGroup = (page: Page) => page.getByRole('group', { name: 'Letter tray' });
const trayButtons = (page: Page) => trayGroup(page).getByRole('button');

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

interface SeedOptions {
  length?: Length;
  /** Letters already placed in the answer row, left to right. */
  typed?: string;
  /** Positions locked by hints; their letters come from the target. */
  hinted?: number[];
  status?: 'playing' | 'solved';
}

/** Saves a WordShuffle puzzle with a real target before the page loads. */
async function seedPuzzle(page: Page, options: SeedOptions = {}): Promise<void> {
  const { length = 5, typed = '', hinted = [], status = 'playing' } = options;
  const target = TARGETS[length];
  const scramble = SCRAMBLES[length];
  const solved = status === 'solved';

  const slots: (string | null)[] = Array.from({ length }, () => null);
  for (const position of hinted) slots[position] = target[position] as string;
  let next = 0;
  for (const letter of typed) {
    while (slots[next] !== null) next += 1;
    slots[next] = letter;
  }
  if (solved) target.split('').forEach((letter, index) => (slots[index] = letter));

  const tray = [...scramble];
  for (const slot of slots) {
    const at = slot === null ? -1 : tray.indexOf(slot);
    if (at !== -1) tray.splice(at, 1);
  }

  const session = {
    id: 'e2e-puzzle',
    wordLength: length,
    target,
    scramble,
    tray,
    slots,
    hinted,
    status,
    found: solved ? target : null,
    anagrams:
      solved && length === 6 ? ['ELINTS', 'ENLIST', 'INLETS', 'LISTEN', 'SILENT', 'TINSEL'] : [],
    startedAt: 1,
    finishedAt: solved ? 2 : null,
  };

  await page.addInitScript(
    ([value, len]: [string, number]) => {
      localStorage.setItem(
        'wordgames:v1:shuffle:prefs',
        JSON.stringify({ defaultWordLength: len }),
      );
      // Seed once, so a reload inside a test keeps the puzzle it has built.
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('wordgames:v1:shuffle:session', value);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [JSON.stringify(session), length] as [string, number],
  );
}

async function openShuffle(page: Page): Promise<void> {
  await page.goto(SHUFFLE_URL);
  await expect(answerRow(page)).toBeVisible();
  // The dictionary has loaded once the tray buttons are enabled.
  await expect(trayButtons(page).first()).toBeEnabled();
}

// Reduced motion keeps dialogs from fading while axe reads colours.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('opening and navigating (AC-45)', () => {
  test('Home has a WordShuffle card in catalogue order, and it opens the game', async ({
    page,
  }) => {
    await page.goto('/');

    const links = page.getByRole('list').getByRole('link');
    await expect(links).toHaveCount(6);
    await expect(links.nth(5)).toHaveAccessibleName('Play WordShuffle');

    await page.getByRole('link', { name: 'Play WordShuffle' }).click();

    await expect(page).toHaveURL(/#\/shuffle$/);
    await expect(heading(page)).toHaveText('WordShuffle');
    await expect(heading(page)).toBeFocused();
    await expect(page).toHaveTitle('WordShuffle · WordGames');
  });
});

test.describe('playing (FR-139, FR-141, AC-53)', () => {
  test('a real puzzle opens with a full tray, an empty row and 5 letters', async ({ page }) => {
    await openShuffle(page);

    await expect(trayButtons(page)).toHaveCount(5);
    await expect(answerRow(page)).toHaveAccessibleName(
      'Your answer: empty, empty, empty, empty, empty',
    );
    await expect(page.getByRole('radio', { name: /^5/ })).toBeChecked();
  });

  test('typing and tapping build the same answer, and Backspace returns a letter', async ({
    page,
  }) => {
    await seedPuzzle(page);
    await openShuffle(page);

    await page.keyboard.type('PL');
    await trayGroup(page).getByRole('button', { name: /^A, / }).click();
    await expect(answerRow(page)).toHaveAccessibleName('Your answer: P, L, A, empty, empty');

    await page.keyboard.press('Backspace');
    await expect(answerRow(page)).toHaveAccessibleName('Your answer: P, L, empty, empty, empty');
    await expect(trayButtons(page)).toHaveCount(3);

    // A letter that is not left in the tray is ignored, with no toast (EC-46).
    await page.keyboard.type('zq');
    await expect(answerRow(page)).toHaveAccessibleName('Your answer: P, L, empty, empty, empty');
    await expect(page.getByRole('alert')).toBeEmpty();
  });

  test('any real anagram solves, and the result lists the others from the real list (AC-53)', async ({
    page,
  }) => {
    await seedPuzzle(page, { length: 6 });
    await openShuffle(page);

    await page.keyboard.type('silent');
    await page.keyboard.press('Enter');

    const panel = page.getByRole('region', { name: 'Solved!' });
    await expect(panel).toContainText('SILENT');
    await expect(panel.getByRole('listitem')).toHaveText([
      'ELINTS',
      'ENLIST',
      'INLETS',
      'LISTEN',
      'TINSEL',
    ]);
  });

  test('a row that is not a word is rejected and keeps the row', async ({ page }) => {
    await seedPuzzle(page);
    await openShuffle(page);

    await page.keyboard.type('alnpt');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('alert')).toHaveText('Not in word list');
    await expect(answerRow(page)).toHaveAccessibleName('Your answer: A, L, N, P, T');
  });

  test('a partial row says so and costs nothing', async ({ page }) => {
    await seedPuzzle(page);
    await openShuffle(page);

    await page.keyboard.type('pla');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('alert')).toHaveText('Not enough letters');
    await expect(answerRow(page)).toHaveAccessibleName('Your answer: P, L, A, empty, empty');
  });

  test('hints lock letters in place, typing skips them and Backspace keeps them (AC-54)', async ({
    page,
  }) => {
    await seedPuzzle(page);
    await openShuffle(page);

    await page.getByRole('button', { name: 'Hint, 2 left' }).click();
    await expect(answerRow(page)).toHaveAccessibleName(
      'Your answer: P (hinted), empty, empty, empty, empty',
    );
    await page.keyboard.type('la');
    await expect(answerRow(page)).toHaveAccessibleName(
      'Your answer: P (hinted), L, A, empty, empty',
    );
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(answerRow(page)).toHaveAccessibleName(
      'Your answer: P (hinted), empty, empty, empty, empty',
    );

    await page.getByRole('button', { name: 'Hint, 1 left' }).click();
    await expect(page.getByRole('button', { name: 'Hint, 0 left' })).toBeDisabled();
  });

  test('finding the word shows the result, and the next Enter starts a new puzzle (AC-55)', async ({
    page,
  }) => {
    await seedPuzzle(page);
    await openShuffle(page);

    await page.keyboard.type('plant');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeHidden();
    await expect(answerRow(page)).toHaveAccessibleName(
      'Your answer: empty, empty, empty, empty, empty',
    );
  });

  test('give up asks, then shows the word and every anagram', async ({ page }) => {
    await seedPuzzle(page, { length: 6 });
    await openShuffle(page);

    await page.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Give up' }).click();

    const panel = page.getByRole('region', { name: 'Gave up' });
    await expect(panel).toContainText('LISTEN');
    await expect(panel.getByRole('listitem')).toHaveText([
      'ELINTS',
      'ENLIST',
      'INLETS',
      'SILENT',
      'TINSEL',
    ]);
  });

  test('reload keeps the tray, the answer row and the hints (FR-147)', async ({ page }) => {
    await seedPuzzle(page, { length: 6, hinted: [0], typed: 'ST' });
    await openShuffle(page);
    await page.waitForTimeout(300);

    await page.reload();

    await expect(answerRow(page)).toHaveAccessibleName(
      'Your answer: L (hinted), S, T, empty, empty, empty',
    );
    await expect(trayButtons(page)).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Hint, 1 left' })).toBeVisible();
  });

  test('Home → WordShuffle → All games → Home, with the keyboard only', async ({ page }) => {
    await seedPuzzle(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Play WordShuffle' }).focus();
    await page.keyboard.press('Enter');
    await expect(answerRow(page)).toBeVisible();
    await expect(trayButtons(page).first()).toBeEnabled();

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
        // A hinted letter, typed letters and a tray that is part used.
        await seedPuzzle(page, { length: 6, hinted: [0], typed: 'ST' });
        await openShuffle(page);
        await page.waitForTimeout(200);

        expect((await scan(page)).violations).toEqual([]);
      });
    }
  }

  for (const length of [4, 5] as const) {
    test(`a ${String(length)}-letter puzzle has no violations`, async ({ page }) => {
      await seedPuzzle(page, { length });
      await openShuffle(page);

      expect((await scan(page)).violations).toEqual([]);
    });
  }

  test('the help dialog has no violations', async ({ page }) => {
    await openShuffle(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the statistics dialog has no violations, empty and with games', async ({ page }) => {
    await openShuffle(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.keyboard.press('Escape');

    await page.evaluate(() => {
      localStorage.removeItem('wordgames:v1:shuffle:session');
    });
    await seedPuzzle(page);
    await page.reload();
    await expect(trayButtons(page).first()).toBeEnabled();
    await page.keyboard.type('plant');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toContainText('PLANT');

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the solved result panel has no violations', async ({ page }) => {
    await seedPuzzle(page, { length: 6, status: 'solved' });
    await page.goto(SHUFFLE_URL);

    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the give up confirmation has no violations', async ({ page }) => {
    await seedPuzzle(page);
    await openShuffle(page);
    await page.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe('layout (FR-139, FR-59, AC-22)', () => {
  const VIEWPORTS = [
    { name: '320 x 568', width: 320, height: 568 },
    { name: '375 x 667', width: 375, height: 667 },
    { name: '768 x 1024', width: 768, height: 1024 },
    { name: '2560 x 1440', width: 2560, height: 1440 },
    { name: '740 x 360 landscape', width: 740, height: 360 },
  ];

  for (const length of [4, 6] as const) {
    for (const viewport of VIEWPORTS) {
      test(`${String(length)} letters at ${viewport.name}: everything in view, tray on one row, no horizontal scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await seedPuzzle(page, { length });
        await openShuffle(page);

        await expect(answerRow(page)).toBeInViewport();
        await expect(trayButtons(page).first()).toBeInViewport();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        // The whole tray sits on one row, so a 6-letter tray fits across 320 px.
        const tops = await trayButtons(page).evaluateAll((buttons) =>
          buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
        );
        expect(new Set(tops).size).toBe(1);
      });
    }
  }

  test('the result panel fits at 320 px with the anagram list', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedPuzzle(page, { length: 6, status: 'solved' });
    await page.goto(SHUFFLE_URL);

    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('tray buttons, controls and header buttons are at least 44 px', async ({ page }) => {
    await seedPuzzle(page, { length: 6 });
    await openShuffle(page);

    for (const box of await trayButtons(page).evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    )) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['Backspace', 'Submit', 'Reshuffle', 'Give up']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const hint = await page.getByRole('button', { name: /^Hint/ }).boundingBox();
    expect(hint?.height ?? 0).toBeGreaterThanOrEqual(44);
    for (const name of ['How to play', 'New puzzle', 'Statistics', 'Settings']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
