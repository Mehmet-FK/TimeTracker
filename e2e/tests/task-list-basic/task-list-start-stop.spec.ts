import { expect, test } from '../../fixtures/test.fixture';

test.describe('Task List - Start/Stop', () => {
  test('should create, start and stop a new task from the header play button', async ({
    page,
    workViewPage,
  }) => {
    // Wait for work view to be ready
    await workViewPage.waitForTaskList();

    // An existing task must not be started by the header play button
    await workViewPage.addTask('0 C existing task');
    const existingTask = page.locator('task', { hasText: '0 C existing task' });

    const playBtn = page.locator('.play-btn.tour-playBtn').first();
    await playBtn.waitFor({ state: 'visible' });
    await playBtn.click();

    // Starting the timer starts a new task right away and focuses the title input
    const titleInput = page.locator('timer-title-input input');
    await expect(titleInput).toBeFocused();
    await expect(page.locator('task.isCurrent')).toHaveCount(1);
    await expect(existingTask).not.toHaveClass(/isCurrent/);

    // The title is typed while the timer runs; short syntax adds the tag
    await titleInput.fill('0 C new task #e2etag');
    await titleInput.press('Enter');
    // a new tag needs to be confirmed
    await page.locator('dialog-confirm [e2e="confirmBtn"]').click();

    const newTask = page.locator('task', { hasText: '0 C new task' });
    await expect(newTask).toHaveClass(/isCurrent/, { timeout: 5000 });
    await expect(newTask.locator('tag', { hasText: 'e2etag' })).toBeVisible();
    await expect(titleInput).toHaveValue('0 C new task');

    // Clicking the play button again stops the running task
    await playBtn.click();
    await expect(newTask).not.toHaveClass(/isCurrent/, { timeout: 5000 });
    await expect(titleInput).toHaveValue('');
  });

  test('should start a new task with the title typed before starting', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();

    const titleInput = page.locator('timer-title-input input');
    await titleInput.fill('0 C typed first');
    await titleInput.press('Enter');

    const newTask = page.locator('task', { hasText: '0 C typed first' });
    await expect(newTask).toHaveClass(/isCurrent/, { timeout: 5000 });
  });
});
