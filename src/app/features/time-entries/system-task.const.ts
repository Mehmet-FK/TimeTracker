/**
 * The "Unassigned" system task: the header play button tracks time on it while
 * no title is given, so starting the timer does not create a task each time.
 * Entries can later be moved to a real task on the time entries page.
 *
 * It lives in a project hidden from the menu, so it shows up in no task list.
 * Fixed ids, so it is found again after a restart.
 */
export const SYSTEM_PROJECT_ID = 'TIME_TRACKING_SYSTEM_PROJECT';
export const SYSTEM_PROJECT_TITLE = 'Time Tracking System';
export const SYSTEM_TASK_ID = 'TIME_TRACKING_UNASSIGNED_TASK';
export const SYSTEM_TASK_TITLE = 'Unassigned';
