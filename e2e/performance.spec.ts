import { expect, test, type Page } from '@playwright/test';

import { openWeaver } from './weaverHelpers';

/**
 * WordWeaver generation timings under CPU throttling (T-72: NFR-13, AC-37).
 *
 * Chrome's 4x CPU slowdown is what Lighthouse's mobile profile applies, so
 * these approximate its budget. They time what the player waits for, in the
 * page, from the click to the first rendered row of the new puzzle:
 *   - the first 5-letter puzzle: the `lists-5` chunk loads, the ladder graph is
 *     built, a puzzle is generated and the board renders (budget 400 ms p95);
 *   - each later puzzle: one more BFS and render (budget 150 ms p95).
 *
 * Desktop project only: it throttles the CPU itself, so running it again on
 * the mobile project would throttle twice.
 */

const RUNS = 12;
const THROTTLE = 4;
const FIRST_BUDGET_MS = 400;
const LATER_BUDGET_MS = 150;

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] as number;
}

/** Clicks `selector` and resolves with ms until a 5-letter Start row is on screen. */
async function timeToFiveLetterRow(page: Page, clickSelector: string): Promise<number> {
  return page.evaluate(
    (selector: string) =>
      new Promise<number>((resolve) => {
        const begin = performance.now();
        (document.querySelector(selector) as HTMLElement).click();

        const check = (): void => {
          const row = document.querySelector('[role="row"][aria-label="Start"]');
          if (row && row.children.length === 5) {
            resolve(performance.now() - begin);
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      }),
    clickSelector,
  );
}

test.describe('generation timing (NFR-13, AC-37)', () => {
  test.skip(({ isMobile }) => isMobile, 'throttles the CPU itself; run on the desktop project');

  test(`the first 5-letter puzzle is within ${String(FIRST_BUDGET_MS)} ms p95 and later ones within ${String(LATER_BUDGET_MS)} ms`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const cdp = await page.context().newCDPSession(page);

    const first: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      // A fresh load each time, so the 5-letter chunk and graph are cold.
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await openWeaver(page);
      await page.evaluate(() => {
        localStorage.clear();
      });
      await page.reload();
      await expect(page.getByRole('grid', { name: 'Word ladder' })).toBeVisible();

      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      first.push(await timeToFiveLetterRow(page, '[data-length="5"]'));
    }

    // Later puzzles on the 5-letter graph, still throttled.
    const later: number[] = [];
    for (let run = 0; run < RUNS * 2; run += 1) {
      later.push(
        await page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const begin = performance.now();
              // Text, not the element: React reuses the row and changes its contents.
              const before = document.querySelector(
                '[role="row"][aria-label="Start"]',
              )?.textContent;
              const button = [...document.querySelectorAll('button')].find(
                (b) => b.textContent === 'New puzzle',
              ) as HTMLElement;
              button.click();

              const check = (): void => {
                const row = document.querySelector('[role="row"][aria-label="Start"]');
                const changed = row && row.textContent !== before;
                if (changed) resolve(performance.now() - begin);
                else if (performance.now() - begin > 2000) resolve(2000);
                else requestAnimationFrame(check);
              };
              check();
            }),
        ),
      );
    }

    const summary = {
      throttle: `${String(THROTTLE)}x CPU`,
      firstP95Ms: Math.round(p95(first)),
      firstMaxMs: Math.round(Math.max(...first)),
      laterP95Ms: Math.round(p95(later)),
      laterMaxMs: Math.round(Math.max(...later)),
    };
    // Recorded in the report so the numbers can be copied into ACCEPTANCE.md.
    testInfo.annotations.push({ type: 'timings', description: JSON.stringify(summary) });
    console.log(`WordWeaver timings: ${JSON.stringify(summary)}`);

    expect(p95(first)).toBeLessThanOrEqual(FIRST_BUDGET_MS);
    expect(p95(later)).toBeLessThanOrEqual(LATER_BUDGET_MS);
  });
});
