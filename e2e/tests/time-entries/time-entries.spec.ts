import { expect, test } from '../../fixtures/test.fixture';

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
    await row.locator('input[type="time"]').nth(1).fill('11:00');
    await expect(row).toContainText('2h');

    await page.reload();
    await expect(row).toContainText('2h');

    // delete
    await row.locator('button').click();
    await page.locator('dialog-confirm [e2e="confirmBtn"]').click();
    await expect(row).toHaveCount(0);
    await page.goto('/#/tag/TODAY/tasks');
    await expect(page.locator('task', { hasText: title })).not.toContainText('1h');
  });
});
