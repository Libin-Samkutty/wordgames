import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WordHang in a real browser (T-102, T-103: AC-45, AC-55, AC-57, AC-60, FR-169,
 * FR-170). Runs on the shipped lists.
 *
 * The secret is random in a real game, so tests that need a known word save a
 * game whose secret is a real answer: LAMB, PLANT or PLANET. That is the same
 * path a reload takes (FR-173), so it also exercises restore.
 */

const HANG_URL = '/#/hang';
const SECRETS = { 4: 'LAMB', 5: 'PLANT', 6: 'PLANET' } as const;
type Length = keyof typeof SECRETS;

/** Letters that are in none of the three secrets, so each is a miss. */
const MISSES = 'QZXJKV';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const word = (page: Page) => page.getByRole('group', { name: /^Word:/ });
const keyboard = (page: Page) => page.getByLabel('Keyboard');
const key = (page: Page, letter: string) =>
  keyboard(page).getByRole('button', { name: new RegExp(`^${letter}(,|$)`) });
async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

interface SeedOptions {
  length?: Length;
  /** The letters already tried, in order. */
  tried?: string;
}

/** Saves a WordHang game with a real secret before the page loads. */
async function seedGame(page: Page, options: SeedOptions = {}): Promise<void> {
  const { length = 5, tried = '' } = options;
  const secret = SECRETS[length];
  const solved = [...secret].every((letter) => tried.includes(letter));
  const missed = [...tried].filter((letter) => !secret.includes(letter)).length;
  const status = solved ? 'won' : missed >= 6 ? 'lost' : 'playing';
  const session = {
    id: 'e2e-game',
    wordLength: length,
    secret,
    tried,
    status,
    startedAt: tried === '' ? null : 1,
    finishedAt: status === 'playing' ? null : 2,
  };
  await page.addInitScript(
    ([value, len]: [string, number]) => {
      localStorage.setItem('wordgames:v1:hang:prefs', JSON.stringify({ defaultWordLength: len }));
      // Seed once, so a reload inside a test keeps the game it has built.
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('wordgames:v1:hang:session', value);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [JSON.stringify(session), length] as [string, number],
  );
}

async function openHang(page: Page): Promise<void> {
  await page.goto(HANG_URL);
  await expect(word(page)).toBeVisible();
  // The dictionary has loaded once the keyboard is there.
  await expect(key(page, 'Q')).toBeVisible();
}

// Reduced motion keeps dialogs from fading while axe reads colours.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('opening and navigating (AC-45)', () => {
  test('Home has a WordHang card in catalogue order, and it opens the game', async ({ page }) => {
    await page.goto('/');

    const links = page.getByRole('list').getByRole('link');
    await expect(links).toHaveCount(9);
    await expect(links.nth(8)).toHaveAccessibleName('Play WordHang');

    await page.getByRole('link', { name: 'Play WordHang' }).click();

    await expect(page).toHaveURL(/#\/hang$/);
    await expect(heading(page)).toHaveText('WordHang');
    await expect(heading(page)).toBeFocused();
    await expect(page).toHaveTitle('WordHang · WordGames');
  });
});

test.describe('playing (FR-169, FR-170, AC-60)', () => {
  test('a real game opens with a hidden word, 26 letter keys and 5 letters', async ({ page }) => {
    await openHang(page);

    await expect(word(page)).toHaveAccessibleName('Word: blank, blank, blank, blank, blank');
    await expect(keyboard(page).getByRole('button')).toHaveCount(26);
    await expect(page.getByRole('radio', { name: /^5/ })).toBeChecked();
    await expect(page.getByText('0 of 6 misses')).toBeVisible();
  });

  test('a letter in the word shows in its place and a miss is drawn and counted', async ({
    page,
  }) => {
    await seedGame(page);
    await openHang(page);

    await page.keyboard.press('p');
    await expect(word(page)).toHaveAccessibleName('Word: P, blank, blank, blank, blank');
    await expect(key(page, 'P')).toBeDisabled();

    await page.keyboard.press('z');
    await expect(page.getByText('1 of 6 misses')).toBeVisible();
    await expect(key(page, 'Z')).toHaveAccessibleName('Z, not in the word');
    await expect(page.locator('svg[data-misses="1"]')).toBeVisible();
  });

  test('tapping a key guesses it, and a repeat is ignored', async ({ page }) => {
    await seedGame(page);
    await openHang(page);

    await key(page, 'L').click();
    await page.keyboard.press('l');

    await expect(word(page)).toHaveAccessibleName('Word: blank, L, blank, blank, blank');
    await expect(page.getByText('0 of 6 misses')).toBeVisible();
  });

  test('revealing every letter wins, and the next Enter starts a new game (AC-55)', async ({
    page,
  }) => {
    await seedGame(page, { tried: 'PLAN' });
    await openHang(page);

    await page.keyboard.press('t');

    await expect(page.getByRole('heading', { name: 'You saved them!' })).toBeVisible();
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'You saved them!' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'You saved them!' })).toContainText('PLANT');

    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'You saved them!' })).toBeHidden();
    await expect(page.getByText('0 of 6 misses')).toBeVisible();
  });

  test('the sixth miss loses and shows the word', async ({ page }) => {
    await seedGame(page, { tried: MISSES.slice(0, 5) });
    await openHang(page);

    await page.keyboard.press(MISSES[5] as string);

    await expect(page.getByRole('heading', { name: 'Out of misses' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Out of misses' })).toContainText('PLANT');
    await expect(word(page)).toHaveAccessibleName('Word: PLANT');
  });

  test('switching length after a letter asks, and Switch opens the new length', async ({
    page,
  }) => {
    await seedGame(page);
    await openHang(page);
    await page.keyboard.press('p');

    await page.getByRole('radio', { name: /^4/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Switch' }).click();

    await expect(page.getByRole('radio', { name: /^4/ })).toBeChecked();
    await expect(word(page)).toHaveAccessibleName('Word: blank, blank, blank, blank');
  });

  test('a game survives a reload with its letters and its figure (FR-173)', async ({ page }) => {
    await seedGame(page);
    await openHang(page);
    await page.keyboard.type('pzq');
    await page.waitForTimeout(300);

    await page.reload();

    await expect(word(page)).toHaveAccessibleName('Word: P, blank, blank, blank, blank');
    await expect(page.getByText('2 of 6 misses')).toBeVisible();
    await expect(key(page, 'Z')).toHaveAccessibleName('Z, not in the word');
    await expect(page.locator('svg[data-misses="2"]')).toBeVisible();
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
        // Letters in the word and misses, so the keys, the word and the figure all show state.
        await seedGame(page, { tried: 'PAZQE' });
        await openHang(page);
        await page.waitForTimeout(200);

        expect((await scan(page)).violations).toEqual([]);
      });
    }
  }

  for (const length of [4, 6] as const) {
    test(`a ${String(length)}-letter game has no violations`, async ({ page }) => {
      await seedGame(page, { length, tried: 'AZ' });
      await openHang(page);

      expect((await scan(page)).violations).toEqual([]);
    });
  }

  test('the help dialog has no violations', async ({ page }) => {
    await openHang(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the statistics dialog has no violations, empty and with games', async ({ page }) => {
    await openHang(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.keyboard.press('Escape');

    await page.evaluate(() => {
      localStorage.removeItem('wordgames:v1:hang:session');
    });
    await seedGame(page, { tried: 'PLAN' });
    await page.reload();
    await expect(key(page, 'Q')).toBeVisible();
    await page.keyboard.press('t');
    await expect(page.getByRole('heading', { name: 'You saved them!' })).toBeVisible();
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toContainText('PLANT');

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the result panel has no violations, after a win and after a loss', async ({ page }) => {
    await seedGame(page, { tried: 'PLANT' });
    await page.goto(HANG_URL);
    await expect(page.getByRole('heading', { name: 'You saved them!' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the loss panel and the revealed word have no violations', async ({ page }) => {
    await seedGame(page, { tried: `P${MISSES}` });
    await page.goto(HANG_URL);

    await expect(page.getByRole('heading', { name: 'Out of misses' })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });

  test('the confirmation dialog has no violations', async ({ page }) => {
    await seedGame(page, { tried: 'P' });
    await openHang(page);
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe('layout (FR-171, FR-59, AC-22)', () => {
  const VIEWPORTS = [
    { name: '320 x 568', width: 320, height: 568 },
    { name: '375 x 667', width: 375, height: 667 },
    { name: '768 x 1024', width: 768, height: 1024 },
    { name: '2560 x 1440', width: 2560, height: 1440 },
    { name: '740 x 360 landscape', width: 740, height: 360 },
  ];

  for (const length of [4, 6] as const) {
    for (const viewport of VIEWPORTS) {
      test(`${String(length)} letters at ${viewport.name}: figure, word and keyboard in view, no horizontal scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await seedGame(page, {
          length,
          tried: `${length === 4 ? 'A' : 'AE'}${MISSES.slice(0, 5)}`,
        });
        await openHang(page);

        await expect(page.locator('svg[data-misses]')).toBeInViewport();
        await expect(word(page)).toBeInViewport();
        await expect(key(page, 'Q')).toBeInViewport();
        await expect(key(page, 'M')).toBeInViewport();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }

  test('keys, radios and header buttons are at least 44 px', async ({ page }) => {
    await openHang(page);

    for (const letter of ['Q', 'A', 'M']) {
      const box = await key(page, letter).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
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
