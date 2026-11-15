/**
 * Single-session capture of every mobile scenario across both locales and
 * both themes. NgRx-dispatch flips locale and theme; no relaunch / re-import.
 *
 * Order:
 *   en × dark   (slots 03, 05, 06)
 *   en × light  (slot 04)
 *   de × dark   (slots 03, 05, 06)
 *   de × light  (slot 04)
 */
import { test } from '../../fixture';
import { LOCALES, type Locale } from '../../matrix';
import {
  applyLocale,
  applyTheme,
  applyTimeTrackingEnabled,
  gotoAndSettle,
  resetView,
  scrollScheduleUp,
  showMarketingOverlay,
} from '../../helpers';
import { MARKETING_HEADLINE, MARKETING_SUBLINE } from '../../marketing-copy';
import type { Page } from '@playwright/test';

const captureDarkScenes = async (
  page: Page,
  shoot: (scenario: string, name: string) => Promise<void>,
): Promise<void> => {
  // 03 — Eisenhower board
  await gotoAndSettle(page, '/#/boards');
  await page.locator('boards').first().waitFor({ state: 'visible' });
  await page
    .locator('board-panel, .panel, mat-card')
    .first()
    .waitFor({ state: 'visible' });
  await shoot('mobile-03-eisenhower', 'eisenhower');
  await resetView(page);

  // 05 — Schedule
  await gotoAndSettle(page, '/#/schedule');
  await page.locator('schedule, schedule-week').first().waitFor({ state: 'visible' });
  await scrollScheduleUp(page);
  await shoot('mobile-05-schedule', 'schedule');
  await resetView(page);

  // 06 — Today list
  await gotoAndSettle(page, '/#/tag/TODAY/tasks');
  await page.locator('task').first().waitFor({ state: 'visible' });
  await shoot('mobile-06-today', 'today');
};

const captureLightScenes = async (
  page: Page,
  shoot: (scenario: string, name: string) => Promise<void>,
): Promise<void> => {
  // 04 — Schedule (light variant)
  await gotoAndSettle(page, '/#/schedule');
  await page.locator('schedule, schedule-week').first().waitFor({ state: 'visible' });
  await scrollScheduleUp(page);
  await shoot('mobile-04-schedule-light', 'schedule-light');
};

test.describe('@screenshot mobile all', () => {
  test.use({ locale: 'en', theme: 'dark' });

  test('every mobile variant in one session', async ({
    seededPage,
    screenshotMaster,
  }) => {
    // 12 captures × ~15–20s each on a mobile viewport overruns the 180s default.
    test.setTimeout(8 * 60 * 1000);
    const page = seededPage;

    // Mobile rows look cleaner without the per-task play button column.
    await applyTimeTrackingEnabled(page, false);

    // 00 — Cover/hero. Today list with a marketing caption strip overlaid.
    await applyTheme(page, 'dark');
    await gotoAndSettle(page, '/#/tag/TODAY/tasks');
    await page.locator('task').first().waitFor({ state: 'visible' });
    await showMarketingOverlay(page, MARKETING_HEADLINE, MARKETING_SUBLINE);
    await screenshotMaster('mobile-00-hero', 'hero');
    await resetView(page);

    for (let i = 0; i < LOCALES.length; i += 1) {
      const lng = LOCALES[i] as Locale;
      if (i > 0) await applyLocale(page, lng);

      await applyTheme(page, 'dark');
      await captureDarkScenes(page, screenshotMaster);

      await applyTheme(page, 'light');
      await captureLightScenes(page, screenshotMaster);
    }
  });
});
