import { expect, test } from '../../fixtures/test.fixture';
import { waitForStatePersistence } from '../../utils/waits';
import type { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { strFromU8, unzipSync } from 'fflate';

/** Edits right after the route's enter animation can be lost, as in base.page.ts. */
const waitForAnimations = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => document.getAnimations().filter((a) => a.playState === 'running').length === 0,
  );

test.describe('Time Entries', () => {
  test('records an entry while tracking and keeps it after a reload', async ({
    page,
    workViewPage,
    testPrefix,
  }) => {
    const title = `${testPrefix}-tracked`;
    await workViewPage.waitForTaskList();

    // start a new task from the header play button, then stop it again
    const playBtn = page.locator('.play-btn.tour-playBtn').first();
    await playBtn.click();
    const titleInput = page.locator('dialog-prompt input');
    await titleInput.fill(title);
    await titleInput.press('Enter');
    await expect(page.locator('task', { hasText: title })).toHaveClass(/isCurrent/);
    // entries shorter than a second are not stored
    await page.waitForTimeout(1500);
    await playBtn.click();
    await expect(page.locator('task', { hasText: title })).not.toHaveClass(/isCurrent/);

    await page.goto('/#/time-entries');
    const row = page.locator('.entry-row:not(.header)', { hasText: title });
    await expect(row).toHaveCount(1);

    await waitForStatePersistence(page);
    await page.reload();
    await expect(row).toHaveCount(1);
  });

  test('adds, edits and deletes an entry', async ({ page, workViewPage, testPrefix }) => {
    const title = `${testPrefix}-manual`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(title);

    await page.goto('/#/time-entries');
    const form = page.locator('.add-form');
    await form.locator('input[name="task"]').fill(title);
    await page.locator('mat-option', { hasText: title }).click();
    await form.locator('input[name="start"]').fill('09:00');
    await form.locator('input[name="end"]').fill('10:30');
    await form.locator('button[type="submit"]').click();

    const row = page.locator('.entry-row:not(.header)', { hasText: title });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('1h 30m');
    // no duplicate task was created for the selected title
    await page.goto('/#/tag/TODAY/tasks');
    await expect(page.locator('task', { hasText: title })).toHaveCount(1);
    await expect(page.locator('task', { hasText: title })).toContainText('1h 30m');

    // edit the end time
    await page.goto('/#/time-entries');
    await expect(row).toHaveCount(1);
    await waitForAnimations(page);
    await row.locator('input[type="time"]').nth(1).fill('11:00');
    await expect(row).toContainText('2h');

    await waitForStatePersistence(page);
    await page.reload();
    await expect(row).toContainText('2h');

    // delete
    await row.locator('button').click();
    await page.locator('dialog-confirm [e2e="confirmBtn"]').click();
    await expect(row).toHaveCount(0);
    await page.goto('/#/tag/TODAY/tasks');
    await expect(page.locator('task', { hasText: title })).not.toContainText('1h');
  });

  test('stores a "requested by" value and suggests it for the next entry', async ({
    page,
    workViewPage,
    testPrefix,
  }) => {
    const title = `${testPrefix}-requested`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(title);

    await page.goto('/#/time-entries');
    const form = page.locator('.add-form');
    const formRequestedBy = form.locator('input[name="field-requestedBy"]');
    await form.locator('input[name="task"]').fill(title);
    await page.locator('mat-option', { hasText: title }).click();
    await formRequestedBy.fill('Anna');
    await form.locator('input[name="start"]').fill('09:00');
    await form.locator('input[name="end"]').fill('10:00');
    await form.locator('button[type="submit"]').click();

    const row = page.locator('.entry-row:not(.header)', { hasText: title });
    await expect(row).toHaveCount(1);
    const rowRequestedBy = row.locator('.fields-cell input[aria-label="Requested by"]');
    await expect(rowRequestedBy).toHaveValue('Anna');
    await waitForAnimations(page);

    // edit the value in the list
    await rowRequestedBy.fill('Ben');
    await rowRequestedBy.press('Tab');
    await waitForStatePersistence(page);
    await page.reload();
    await expect(rowRequestedBy).toHaveValue('Ben');

    // a new entry for the same task starts with the latest value
    await form.locator('input[name="task"]').fill(title);
    await page.locator('mat-option', { hasText: title }).click();
    await expect(formRequestedBy).toHaveValue('Ben');
  });

  test('exports the entries of the selected range as xlsx', async ({
    page,
    workViewPage,
    testPrefix,
  }, testInfo) => {
    const title = `${testPrefix}-export`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(title);

    await page.goto('/#/time-entries');
    const form = page.locator('.add-form');
    await form.locator('input[name="task"]').fill(title);
    await page.locator('mat-option', { hasText: title }).click();
    await form.locator('input[name="field-requestedBy"]').fill('Anna');
    await form.locator('input[name="field-ticketNr"]').fill('T-42');
    await form.locator('input[name="start"]').fill('09:00');
    await form.locator('input[name="end"]').fill('10:30');
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('.entry-row:not(.header)', { hasText: title })).toHaveCount(
      1,
    );

    // the default range is the current month, which includes today
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-bar button').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^time-entries_\d{4}-\d{2}-01_\d{4}-\d{2}-\d{2}\.xlsx$/,
    );

    const filePath = testInfo.outputPath('export.xlsx');
    await download.saveAs(filePath);
    const sheet = strFromU8(
      unzipSync(readFileSync(filePath))['xl/worksheets/sheet1.xml'],
    );
    expect(sheet).toContain('Requested by');
    expect(sheet).toContain(title);
    expect(sheet).toContain('Anna');
    expect(sheet).toContain('Ticket Nr');
    expect(sheet).toContain('T-42');
    // 1.5 hours in the decimal column
    expect(sheet).toContain('<v>1.5</v>');
  });
});
