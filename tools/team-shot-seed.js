// Seed data for `heavy shot`: the shot tool runs this file in the page as the
// body of an async function (top-level await and return allowed, no
// import/export/require). It creates projects, tasks and two weeks of time
// entries through the app's own persistent NgRx actions
// (window.__e2eTestHelpers.store, set in src/main.ts for dev builds only),
// then flushes the operation log, so the data survives a reload.
// It is idempotent and returns a short summary containing "seeded".

const MARKER_PROJECT_ID = 'tt-seed-project-1';
const GENERAL_MODULE_ID = 'GENERAL';
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const maxWaitMs =
  typeof window.__teamShotSeedMaxWaitMs === 'number'
    ? window.__teamShotSeedMaxWaitMs
    : 15000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getState = (store) => {
  let state;
  store.subscribe((s) => (state = s)).unsubscribe();
  return state;
};

// The helpers are set after bootstrap, the data after hydration: wait a bit.
const waitedSince = Date.now();
const isReady = () => {
  const h = window.__e2eTestHelpers;
  if (!h || !h.store || typeof h.flushPendingWrites !== 'function') {
    return false;
  }
  const state = getState(h.store);
  return !!(state && state.tasks && state.tasks.isDataLoaded && state.projects);
};
while (!isReady() && Date.now() - waitedSince < maxWaitMs) {
  await wait(100);
}
const helpers = window.__e2eTestHelpers;
if (!helpers || !helpers.store || typeof helpers.flushPendingWrites !== 'function') {
  throw new Error(
    'team-shot-seed: window.__e2eTestHelpers is missing (production or stage build?); nothing was created',
  );
}
const store = helpers.store;
if (!isReady()) {
  throw new Error('team-shot-seed: app data did not finish loading; nothing was created');
}

const countSeed = (state) => {
  const projects = Object.keys(state.projects.entities).filter((id) =>
    id.startsWith('tt-seed-project-'),
  ).length;
  const seedTasks = Object.values(state.tasks.entities).filter(
    (t) => t && t.id.startsWith('tt-seed-task-'),
  );
  const entries = seedTasks.reduce((n, t) => n + (t.timeEntries || []).length, 0);
  return { projects, tasks: seedTasks.length, entries };
};

const before = getState(store);
if (before.projects.entities[MARKER_PROJECT_ID]) {
  const c = countSeed(before);
  return `already seeded, nothing created: ${c.projects} projects, ${c.tasks} tasks, ${c.entries} time entries present`;
}

// Local calendar day string (YYYY-MM-DD) for a date.
const dayStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = Date.now();
const today = new Date(now);
const startOfDay = (offset) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset).getTime();
const todayStr = (before.appState && before.appState.todayStr) || dayStr(today);

const projectDefs = [
  { id: 'tt-seed-project-1', title: 'Website Relaunch', color: '#29a1aa' },
  { id: 'tt-seed-project-2', title: 'Customer Support', color: '#e67e22' },
  { id: 'tt-seed-project-3', title: 'Internal', color: '#8e44ad' },
];
const taskDefs = [
  { id: 'tt-seed-task-1', projectId: 'tt-seed-project-1', title: 'Design landing page', isToday: true },
  { id: 'tt-seed-task-2', projectId: 'tt-seed-project-1', title: 'Implement contact form', isToday: true },
  { id: 'tt-seed-task-3', projectId: 'tt-seed-project-2', title: 'Answer support tickets', isToday: true },
  { id: 'tt-seed-task-4', projectId: 'tt-seed-project-2', title: 'Write FAQ article', isToday: false },
  { id: 'tt-seed-task-5', projectId: 'tt-seed-project-3', title: 'Team meeting', isToday: false },
];

// Entries: [dayOffset, taskIndex, startHour, durationMin, note]. Days 1..13 ago
// sit inside 09:00-17:00; today's entries end before now (see below).
const pastEntries = [
  [1, 0, 9, 90, 'Wireframes'],
  [1, 4, 14, 45, 'Weekly sync'],
  [2, 1, 10, 120, ''],
  [3, 2, 9, 60, 'Ticket backlog'],
  [4, 3, 13, 75, 'First draft'],
  [6, 0, 11, 50, ''],
  [7, 4, 9, 30, 'Planning'],
  [8, 1, 14, 100, 'Validation'],
  [10, 2, 10, 80, ''],
  [11, 3, 15, 40, 'Review'],
  [13, 0, 9, 60, 'Kick-off'],
];
const ranges = pastEntries.map(([offset, taskIndex, hour, minutes, note]) => {
  const start = startOfDay(offset) + hour * HOUR;
  return { taskIndex, start, end: start + minutes * MIN, note };
});
// Two entries today when at least two hours of today have passed, otherwise
// on two other past days, so the count stays the same and nothing is future.
if (now - startOfDay(0) >= 2 * HOUR) {
  ranges.push({ taskIndex: 0, start: now - 110 * MIN, end: now - 70 * MIN, note: 'Hero section' });
  ranges.push({ taskIndex: 2, start: now - 60 * MIN, end: now - 15 * MIN, note: '' });
} else {
  ranges.push({ taskIndex: 0, start: startOfDay(5) + 9 * HOUR, end: startOfDay(5) + 10 * HOUR, note: 'Hero section' });
  ranges.push({ taskIndex: 2, start: startOfDay(12) + 13 * HOUR, end: startOfDay(12) + 14 * HOUR, note: '' });
}

const projectTemplate = (def) => ({
  isHiddenFromMenu: false,
  isArchived: false,
  isDone: false,
  doneOn: null,
  isEnableBacklog: false,
  backlogTaskIds: [],
  noteIds: [],
  advancedCfg: {
    worklogExportSettings: {
      cols: ['DATE', 'START', 'END', 'TIME_CLOCK', 'TITLES_INCLUDING_SUB'],
      roundWorkTimeTo: null,
      roundStartTimeTo: null,
      roundEndTimeTo: null,
      separateTasksBy: ' | ',
      groupBy: 'DATE',
    },
  },
  theme: {
    isAutoContrast: true,
    isDisableBackgroundTint: false,
    primary: def.color,
    huePrimary: '500',
    accent: '#ff4081',
    hueAccent: '500',
    warn: '#e11826',
    hueWarn: '500',
    backgroundImageDark: null,
    backgroundImageLight: null,
    backgroundOverlayOpacity: 20,
    backgroundImageBlur: 0,
  },
  taskIds: [],
  icon: null,
  id: def.id,
  title: def.title,
});

for (const def of projectDefs) {
  // same shape as addProject() in project.actions.ts
  store.dispatch({
    type: '[Project] Add Project',
    project: projectTemplate(def),
    meta: { isPersistent: true, entityType: 'PROJECT', entityId: def.id, opType: 'CRT' },
  });
}

taskDefs.forEach((def, index) => {
  const task = {
    id: def.id,
    projectId: def.projectId,
    subTaskIds: [],
    timeSpentOnDay: {},
    timeSpent: 0,
    timeEstimate: 2 * HOUR,
    isDone: false,
    title: def.title,
    tagIds: [],
    created: now - (14 - index) * 24 * HOUR,
    attachments: [],
    moduleIds: [GENERAL_MODULE_ID],
    ...(def.isToday ? { dueDay: todayStr } : {}),
  };
  // same shape as TaskSharedActions.addTask() in task-shared.actions.ts
  store.dispatch({
    type: '[Task Shared] addTask',
    task,
    workContextId: def.projectId,
    workContextType: 'PROJECT',
    isAddToBacklog: false,
    isAddToBottom: true,
    isIgnoreShortSyntax: true,
    meta: { isPersistent: true, entityType: 'TASK', entityId: def.id, opType: 'CRT' },
  });
});

// Like TimeEntryService.addEntry: entries and their timeSpentOnDay in one update.
let entryNr = 0;
taskDefs.forEach((def, index) => {
  const own = ranges
    .filter((r) => r.taskIndex === index)
    .sort((a, b) => a.start - b.start);
  const timeEntries = own.map((r) => ({
    id: `tt-seed-entry-${++entryNr}`,
    start: r.start,
    end: r.end,
    ...(r.note ? { note: r.note } : {}),
  }));
  const timeSpentOnDay = {};
  for (const e of timeEntries) {
    const day = dayStr(new Date(e.start));
    timeSpentOnDay[day] = (timeSpentOnDay[day] || 0) + (e.end - e.start);
  }
  const timeSpent = Object.values(timeSpentOnDay).reduce((a, b) => a + b, 0);
  // same shape as TaskSharedActions.updateTask() in task-shared.actions.ts
  store.dispatch({
    type: '[Task Shared] updateTask',
    task: { id: def.id, changes: { timeEntries, timeSpentOnDay, timeSpent } },
    meta: { isPersistent: true, entityType: 'TASK', entityId: def.id, opType: 'UPD' },
  });
});

await helpers.flushPendingWrites();

const c = countSeed(getState(store));
if (c.projects !== projectDefs.length || c.tasks !== taskDefs.length || c.entries !== ranges.length) {
  throw new Error(
    `team-shot-seed: store does not contain the seed after dispatch (${c.projects} projects, ${c.tasks} tasks, ${c.entries} entries)`,
  );
}
return `seeded ${c.projects} projects, ${c.tasks} tasks, ${c.entries} time entries`;
