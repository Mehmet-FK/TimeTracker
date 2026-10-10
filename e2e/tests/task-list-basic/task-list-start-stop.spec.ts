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

    // Starting the timer asks for the title of a new task (Toggl-style)
    const titleInput = page.locator('dialog-prompt input');
    await titleInput.fill('0 C new task');
    await titleInput.press('Enter');

    const newTask = page.locator('task', { hasText: '0 C new task' });
    await expect(newTask).toHaveClass(/isCurrent/, { timeout: 5000 });
    await expect(existingTask).not.toHaveClass(/isCurrent/);

    // Clicking the play button again stops the running task
    await playBtn.click();
    await expect(newTask).not.toHaveClass(/isCurrent/, { timeout: 5000 });
    await expect(page.locator('dialog-prompt')).toHaveCount(0);
  });
});
