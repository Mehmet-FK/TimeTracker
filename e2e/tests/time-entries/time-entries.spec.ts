import { expect, test } from '../../fixtures/test.fixture';
import { waitForStatePersistence } from '../../utils/waits';
import { fillMarkdownEditor } from '../../utils/markdown-editor';
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
    const titleInput = page.locator('timer-title-input input');
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
    await row.locator('button[aria-label="Delete entry"]').click();
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
    await page.locator('.export-bar button', { hasText: 'Export' }).click();
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

  test('moves an entry to another task', async ({ page, workViewPage, testPrefix }) => {
    const from = `${testPrefix}-move-from`;
    const to = `${testPrefix}-move-to`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(from);
    await workViewPage.addTask(to);

    await page.goto('/#/time-entries');
    const form = page.locator('.add-form');
    await form.locator('input[name="task"]').fill(from);
    await page.locator('mat-option', { hasText: from }).click();
    await form.locator('input[name="field-requestedBy"]').fill('Anna');
    await form.locator('input[name="start"]').fill('09:00');
    await form.locator('input[name="end"]').fill('10:00');
    await form.locator('button[type="submit"]').click();

    const rows = page.locator('.entry-row:not(.header)');
    await expect(rows).toHaveCount(1);
    await waitForAnimations(page);
    await rows.locator('button[aria-label="Move to another task"]').click();
    await rows.locator('input[aria-label="Move to another task"]').fill(to);
    await page.locator('mat-option', { hasText: to }).click();

    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(to);
    await expect(rows.locator('input[aria-label="Requested by"]')).toHaveValue('Anna');

    await waitForStatePersistence(page);
    await page.reload();
    await expect(rows).toContainText(to);

    // the time moved with the entry
    await page.goto('/#/tag/TODAY/tasks');
    await expect(page.locator('task', { hasText: to })).toContainText('1h');
    await expect(page.locator('task', { hasText: from })).not.toContainText('1h');
  });

  test('tracks time on the "Unassigned" system task when no title is given', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();
    const playBtn = page.locator('.play-btn.tour-playBtn').first();
    await playBtn.click();
    await expect(page.locator('timer-title-input input')).toBeFocused();
    // entries shorter than a second are not stored
    await page.waitForTimeout(1500);
    await playBtn.click();

    // no task was added to any list, also not to Today
    await expect(page.locator('task')).toHaveCount(0);

    await page.goto('/#/time-entries');
    const row = page.locator('.entry-row:not(.header)', { hasText: 'Unassigned' });
    await expect(row).toHaveCount(1);

    // starting again reuses the same system task
    await playBtn.click();
    await page.waitForTimeout(1500);
    await playBtn.click();
    await expect(row).toHaveCount(2);
    await page.goto('/#/tag/TODAY/tasks');
    await expect(page.locator('task')).toHaveCount(0);
  });

  test('keeps a note per entry and exports it as last column', async ({
    page,
    workViewPage,
    testPrefix,
  }, testInfo) => {
    const title = `${testPrefix}-note`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(title);

    await page.goto('/#/time-entries');
    const form = page.locator('.add-form');
    await form.locator('input[name="task"]').fill(title);
    await page.locator('mat-option', { hasText: title }).click();
    await form.locator('input[name="start"]').fill('09:00');
    await form.locator('input[name="end"]').fill('09:30');
    await form.locator('button[type="submit"]').click();

    const row = page.locator('.entry-row:not(.header)', { hasText: title });
    await expect(row).toHaveCount(1);
    const noteBtn = row.locator('button[aria-label="Note"]');
    await expect(noteBtn).toContainText('note_add');
    await waitForAnimations(page);

    // the note opens in the right side panel, which only holds the note
    await noteBtn.click();
    const panel = page.locator('time-entry-panel');
    await expect(panel).toBeVisible();
    await fillMarkdownEditor(panel, 'Reviewed the PR\n- checked tests');
    // saved when leaving the editor, like task notes
    await panel.locator('h2').click();
    await expect(noteBtn).toContainText('sticky_note_2');

    await waitForStatePersistence(page);
    await page.reload();
    await expect(noteBtn).toContainText('sticky_note_2');

    // still editable: the saved note is shown again, and can be changed
    await waitForAnimations(page);
    await noteBtn.click();
    await expect(panel).toContainText('Reviewed the PR');
    await fillMarkdownEditor(panel, 'Reviewed the PR again');
    await panel.locator('h2').click();
    await panel.locator('button[aria-label="Close"]').click();
    await expect(panel).toBeHidden();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-bar button', { hasText: 'Export' }).click();
    const filePath = testInfo.outputPath('export.xlsx');
    await (await downloadPromise).saveAs(filePath);
    const sheet = strFromU8(
      unzipSync(readFileSync(filePath))['xl/worksheets/sheet1.xml'],
    );
    const lastHeader = [
      ...sheet.matchAll(/<c r="([A-Z]+)1"[^>]*>.*?<t[^>]*>([^<]*)</g),
    ].pop();
    expect(lastHeader?.[2]).toBe('Note');
    expect(sheet).toContain('Reviewed the PR again');
  });

  test('assigns existing or new tags and edits fields in the panel', async ({
    page,
    workViewPage,
    testPrefix,
  }, testInfo) => {
    const title = `${testPrefix}-tags`;
    const tagTitle = `${testPrefix}-tag`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(title);

    await page.goto('/#/time-entries');
    const form = page.locator('.add-form');
    await form.locator('input[name="task"]').fill(title);
    await page.locator('mat-option', { hasText: title }).click();
    await form.locator('input[name="start"]').fill('09:00');
    await form.locator('input[name="end"]').fill('09:30');
    await form.locator('button[type="submit"]').click();

    const row = page.locator('.entry-row:not(.header)', { hasText: title });
    await expect(row).toHaveCount(1);
    await waitForAnimations(page);
    await row.locator('button[aria-label="Note"]').click();
    const panel = page.locator('time-entry-panel');
    await expect(panel.locator('input[name="task"]')).toHaveValue(title);

    // a new tag is created, typing the same title again reuses it
    const tagInput = panel.locator('tag-edit input');
    const chips = panel.locator('tag-edit mat-chip-row');
    await tagInput.fill(tagTitle);
    await tagInput.press('Enter');
    await expect(chips).toHaveCount(1);
    await expect(row.locator('tag', { hasText: tagTitle })).toBeVisible();
    await chips.locator('[matChipRemove]').click();
    await expect(chips).toHaveCount(0);
    await tagInput.fill(tagTitle.toUpperCase());
    await tagInput.press('Enter');
    await expect(chips).toHaveCount(1);
    // only one tag with that title exists
    await expect(
      page.locator('magic-side-nav').getByText(tagTitle, { exact: true }),
    ).toHaveCount(1);

    // fields edited in the panel show up in the list
    await panel.locator('input[name="ticketNr"]').fill('T-7');
    await panel.locator('input[name="ticketNr"]').press('Tab');
    await expect(row.locator('input[aria-label="Ticket Nr"]')).toHaveValue('T-7');
    await panel.locator('input[name="end"]').fill('10:00');
    await expect(row).toContainText('1h');
    await expect(panel.locator('input[name="duration"]')).toHaveValue('1h');

    await waitForStatePersistence(page);
    await page.reload();
    await expect(row.locator('tag', { hasText: tagTitle })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-bar button', { hasText: 'Export' }).click();
    const filePath = testInfo.outputPath('export.xlsx');
    await (await downloadPromise).saveAs(filePath);
    const sheet = strFromU8(
      unzipSync(readFileSync(filePath))['xl/worksheets/sheet1.xml'],
    );
    expect(sheet).toContain('>Tags<');
    expect(sheet).toContain(`>${tagTitle}<`);
  });

  test('shows the week in a calendar and follows panel changes', async ({
    page,
    workViewPage,
    testPrefix,
  }) => {
    const title = `${testPrefix}-week`;
    const tagTitle = `${testPrefix}-wtag`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(title);

    await page.goto('/#/time-entries');
    const form = page.locator('.add-form');
    await form.locator('input[name="task"]').fill(title);
    await page.locator('mat-option', { hasText: title }).click();
    await form.locator('input[name="start"]').fill('09:00');
    await form.locator('input[name="end"]').fill('10:00');
    await form.locator('button[type="submit"]').click();
    const row = page.locator('.entry-row:not(.header)', { hasText: title });
    await expect(row).toHaveCount(1);
    await waitForAnimations(page);

    // give the entry a note and a tag to see them on hover
    await row.locator('button[aria-label="Note"]').click();
    const panel = page.locator('time-entry-panel');
    await panel.locator('tag-edit input').fill(tagTitle);
    await panel.locator('tag-edit input').press('Enter');
    await fillMarkdownEditor(panel, 'Reviewed the PR');
    await panel.locator('h2').click();
    await panel.locator('button[aria-label="Close"]').click();

    await page.locator('mat-button-toggle', { hasText: 'Week' }).click();
    const block = page.locator('time-entries-week .block', { hasText: title });
    await expect(block).toContainText('1h');
    await expect(page.locator('time-entries-week .day-head')).toHaveCount(7);
    await expect(page.locator('time-entries-week .day-head').first()).toContainText(
      'Monday',
    );

    await block.hover();
    const hoverCard = page.locator('.hover-card');
    await expect(hoverCard).toContainText('Reviewed the PR');
    await expect(hoverCard.locator('tag', { hasText: tagTitle })).toBeVisible();

    // a change made in the panel moves the entry in the calendar
    await block.click();
    await expect(panel.locator('input[name="task"]')).toHaveValue(title);
    await panel.locator('input[name="end"]').fill('10:30');
    await expect(block).toContainText('1h 30m');

    // other weeks have their own entries
    await page.locator('.day-nav button[aria-label="Previous week"]').click();
    await expect(block).toHaveCount(0);
    await page.locator('.day-nav button[aria-label="Next week"]').click();
    await expect(block).toHaveCount(1);

    // the chosen view is kept
    await page.reload();
    await expect(block).toHaveCount(1);
  });

  test('starts or switches to an existing task picked in the header input', async ({
    page,
    workViewPage,
    testPrefix,
  }) => {
    const first = `${testPrefix}-first existing`;
    const second = `${testPrefix}-second existing`;
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(first);
    await workViewPage.addTask(second);
    const titleInput = page.locator('timer-title-input input');

    // nothing tracked: picking a suggestion starts that task
    await titleInput.fill('first exist');
    await page.locator('mat-option', { hasText: first }).click();
    await expect(page.locator('task', { hasText: first })).toHaveClass(/isCurrent/);
    await expect(titleInput).toHaveValue(first);
    // no task was created or renamed
    await expect(page.locator('task')).toHaveCount(2);
    await page.waitForTimeout(1500);

    // tracked: picking another task moves the running entry there
    await titleInput.fill('second exist');
    await page.locator('mat-option', { hasText: second }).click();
    await expect(page.locator('task', { hasText: second })).toHaveClass(/isCurrent/);
    await expect(page.locator('task', { hasText: first })).toHaveCount(1);
    await expect(page.locator('task')).toHaveCount(2);
    await page.waitForTimeout(1500);
    await page.locator('.play-btn.tour-playBtn').first().click();

    await page.goto('/#/time-entries');
    await expect(
      page.locator('.entry-row:not(.header)', { hasText: second }),
    ).toHaveCount(1);
    await expect(page.locator('.entry-row:not(.header)', { hasText: first })).toHaveCount(
      0,
    );
  });

  test('converts time tracked before time entries existed into entries', async ({
    page,
    workViewPage,
    testPrefix,
  }) => {
    const title = `${testPrefix}-legacy`;
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const day = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
    await workViewPage.waitForTaskList();
    await workViewPage.addTask(title);

    // time without entries, as stored before time entries existed
    await page.evaluate(
      ({ name, date }) => {
        type StoreLike = {
          subscribe: (fn: (state: any) => void) => { unsubscribe: () => void };
          dispatch: (action: unknown) => void;
        };
        const store = (window as unknown as { __e2eTestHelpers: { store: StoreLike } })
          .__e2eTestHelpers.store;
        let taskId = '';
        store
          .subscribe((state) => {
            taskId = Object.values<any>(state.tasks.entities).find(
              (t) => t?.title === name,
            ).id;
          })
          .unsubscribe();
        store.dispatch({
          type: '[Task Shared] updateTask',
          task: {
            id: taskId,
            changes: { timeSpent: 90 * 60_000, timeSpentOnDay: { [date]: 90 * 60_000 } },
          },
          meta: {
            isPersistent: true,
            entityType: 'TASK',
            entityId: taskId,
            opType: 'UPD',
          },
        });
      },
      { name: title, date: day },
    );

    await page.goto('/#/time-entries');
    await waitForAnimations(page);
    await page.locator('.day-nav input[type="date"]').fill(day);
    await expect(page.locator('.untimed-info')).toContainText('1h 30m');
    const row = page.locator('.entry-row:not(.header)', { hasText: title });
    await expect(row).toHaveCount(0);

    await page.locator('.convert-btn').click();
    await page.locator('mat-dialog-container button', { hasText: 'Convert' }).click();

    await expect(row).toHaveCount(1);
    await expect(row).toContainText('1h 30m');
    await expect(row.locator('input[type="time"]').first()).toHaveValue('09:00');
    await expect(page.locator('.untimed-info')).toHaveCount(0);
  });
});
