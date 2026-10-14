import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { openWordwright } from './helpers';

/**
 * Home, hash routing and keyboard navigation in a real browser (T-57:
 * AC-24, AC-25, AC-26, AC-41, AC-43, EC-22).
 */

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Home (AC-24)', () => {
  test('shows a card for each game and requests no word list', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      requests.push(request.url());
    });

    await page.goto('/');

    await expect(heading(page)).toHaveText('wordgames');
    await expect(page.getByRole('link', { name: 'Play WordWright' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Play WordWeaver' })).toBeVisible();

    // Give any stray lazy import time to start.
    await page.waitForTimeout(500);
    expect(requests.filter((url) => url.includes('lists-'))).toEqual([]);
  });

  test('the page title is the suite name', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('wordgames');
  });
});

test.describe('hash navigation (AC-25, AC-26, EC-22)', () => {
  test('a card opens its game, focuses the <h1>, and Back returns Home (AC-25)', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Play WordWeaver' }).click();

    await expect(page).toHaveURL(/#\/weaver$/);
    await expect(heading(page)).toHaveText('WordWeaver');
    await expect(heading(page)).toBeFocused();
    await expect(page).toHaveTitle('WordWeaver · wordgames');

    await page.goBack();

    await expect(heading(page)).toHaveText('wordgames');
    await expect(page).toHaveTitle('wordgames');
  });

  test('a direct load of #/wordwright opens the game without passing through Home (AC-26)', async ({
    page,
  }) => {
    await openWordwright(page);

    await expect(heading(page)).toHaveText('WordWright');
    await expect(page).toHaveTitle('WordWright · wordgames');
  });

  test('an unknown hash shows Home and is corrected without a new history entry (EC-22)', async ({
    page,
  }) => {
    await page.goto('/#/nope');
    const lengthBefore = await page.evaluate(() => history.length);

    await expect(heading(page)).toHaveText('wordgames');
    await expect(page).toHaveURL(/#\/$/);
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore);
  });

  test('leaving Wordwright mid-game and returning restores the board (FR-65)', async ({ page }) => {
    await openWordwright(page);
    await page.keyboard.type('crane');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.keyboard.type('s');

    await page.getByRole('link', { name: 'All games' }).click();
    await expect(heading(page)).toHaveText('wordgames');
    await page.getByRole('link', { name: 'Play WordWright' }).click();

    await expect(page.getByRole('grid', { name: 'Guess board' })).toBeVisible();
    const rows = page.getByRole('row');
    await expect(rows.nth(0).getByRole('gridcell').first()).toHaveAccessibleName(/letter 1: C/);
    await expect(rows.nth(1).getByRole('gridcell').first()).toHaveAccessibleName(
      /letter 1: S, entered/,
    );
  });

  test('Back with Settings open closes it and focuses the new <h1> (EC-38)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Play WordWright' }).click();
    await expect(page.getByRole('grid', { name: 'Guess board' })).toBeVisible();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

    await page.goBack();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(heading(page)).toHaveText('wordgames');
    await expect(heading(page)).toBeFocused();
  });
});

test.describe('keyboard only (AC-41, A11Y-15)', () => {
  test('Home → Wordwright → Home with the keyboard alone', async ({ page }) => {
    await page.goto('/');

    // Settings is in the header, so the first card is the second stop.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Play WordWright' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText('WordWright');
    await expect(heading(page)).toBeFocused();
    await expect(page.getByRole('grid', { name: 'Guess board' })).toBeVisible();

    // All games is the first tab stop in a game: one Shift+Tab from the <h1>.
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('link', { name: 'All games' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(heading(page)).toHaveText('wordgames');
    await expect(heading(page)).toBeFocused();
  });

  test('All games is the first Tab stop in a game view', async ({ page }) => {
    await openWordwright(page);

    await page.keyboard.press('Tab');

    await expect(page.getByRole('link', { name: 'All games' })).toBeFocused();
  });
});

test.describe('Home accessibility (AC-43)', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const palette of ['default', 'colourblind'] as const) {
      test(`has no violations in ${colorScheme} with the ${palette} palette`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto('/');
        if (palette === 'colourblind') {
          await page.getByRole('button', { name: 'Settings' }).click();
          await page.getByRole('switch', { name: 'Colourblind mode' }).click();
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toBeHidden();
        }

        const results = await scan(page);

        expect(results.violations).toEqual([]);
      });
    }
  }
});
