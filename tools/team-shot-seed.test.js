const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const body = fs.readFileSync(path.join(__dirname, 'team-shot-seed.js'), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
// Same wrapper the shot tool uses, with `window` shadowed by the fake.
const runSeed = (fakeWindow) => new AsyncFunction('window', body)(fakeWindow);

const DAY = 24 * 60 * 60 * 1000;
const dayStr = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A store that records actions and applies the few the seed uses. */
const createFakeWindow = () => {
  let state = {
    tasks: { ids: [], entities: {}, isDataLoaded: true },
    projects: { ids: [], entities: {} },
  };
  const actions = [];
  let flushCount = 0;
  const store = {
    dispatch(action) {
      actions.push(action);
      if (action.type === '[Project] Add Project') {
        const p = action.project;
        state = {
          ...state,
          projects: {
            ids: [...state.projects.ids, p.id],
            entities: { ...state.projects.entities, [p.id]: p },
          },
        };
      } else if (action.type === '[Task Shared] addTask') {
        const t = action.task;
        state = {
          ...state,
          tasks: {
            ...state.tasks,
            ids: [...state.tasks.ids, t.id],
            entities: { ...state.tasks.entities, [t.id]: t },
          },
        };
      } else if (action.type === '[Task Shared] updateTask') {
        const { id, changes } = action.task;
        state = {
          ...state,
          tasks: {
            ...state.tasks,
            entities: {
              ...state.tasks.entities,
              [id]: { ...state.tasks.entities[id], ...changes },
            },
          },
        };
      }
    },
    subscribe(fn) {
      fn(state);
      return { unsubscribe() {} };
    },
  };
  const win = {
    __teamShotSeedMaxWaitMs: 0,
    __e2eTestHelpers: {
      store,
      flushPendingWrites: async () => {
        flushCount++;
      },
    },
  };
  return {
    win,
    actions,
    getState: () => state,
    getFlushCount: () => flushCount,
  };
};

test('seeds projects, tasks and time entries through persistent actions', async () => {
  const fake = createFakeWindow();
  const before = Date.now();
  const result = await runSeed(fake.win);
  const after = Date.now();

  assert.match(result, /seeded/);
  assert.ok(fake.getFlushCount() >= 1, 'flushPendingWrites was called');
  for (const a of fake.actions) {
    assert.equal(a.meta.isPersistent, true);
    assert.ok(['PROJECT', 'TASK'].includes(a.meta.entityType));
    assert.ok(['CRT', 'UPD'].includes(a.meta.opType));
  }
  const addProjects = fake.actions.filter((a) => a.type === '[Project] Add Project');
  for (const a of addProjects) {
    assert.equal(a.meta.entityId, a.project.id);
  }
  const addTasks = fake.actions.filter((a) => a.type === '[Task Shared] addTask');
  for (const a of addTasks) {
    assert.equal(a.meta.entityId, a.task.id);
    assert.equal(a.workContextId, a.task.projectId);
    assert.equal(a.workContextType, 'PROJECT');
  }

  const state = fake.getState();
  const projects = Object.values(state.projects.entities);
  assert.ok(projects.length >= 2 && projects.length <= 3, 'projects count');
  const tasks = Object.values(state.tasks.entities);
  assert.ok(tasks.length >= 4, 'at least 4 tasks');
  const projectIds = new Set(projects.map((p) => p.id));
  for (const t of tasks) {
    assert.ok(projectIds.has(t.projectId), 'task belongs to a seeded project');
  }
  assert.equal(new Set(tasks.map((t) => t.projectId)).size, projects.length);

  const entries = tasks.flatMap((t) => t.timeEntries || []);
  assert.ok(entries.length >= 10 && entries.length <= 15, 'entries count');
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
  assert.match(result, new RegExp(`${projects.length} projects`));
  assert.match(result, new RegExp(`${tasks.length} tasks`));
  assert.match(result, new RegExp(`${entries.length} time entries`));

  const oldestDay = dayStr(before - 13 * DAY);
  for (const e of entries) {
    assert.ok(e.end > e.start, 'end after start');
    assert.ok(e.end <= after, 'no future entries');
    assert.ok(dayStr(e.start) >= oldestDay, 'within the last 14 days');
    assert.equal(dayStr(e.start), dayStr(e.end - 1), 'entry sits on one day');
  }
  assert.ok(new Set(entries.map((e) => dayStr(e.start))).size >= 8, 'spread over days');

  for (const t of tasks) {
    const expected = {};
    for (const e of t.timeEntries || []) {
      const day = dayStr(e.start);
      expected[day] = (expected[day] || 0) + (e.end - e.start);
    }
    assert.deepEqual(t.timeSpentOnDay, expected, `timeSpentOnDay of ${t.id}`);
    assert.equal(
      t.timeSpent,
      Object.values(expected).reduce((a, b) => a + b, 0),
    );
  }
});

test('is idempotent', async () => {
  const fake = createFakeWindow();
  await runSeed(fake.win);
  const count = fake.actions.length;
  const stateAfterFirst = fake.getState();

  const result = await runSeed(fake.win);
  assert.equal(fake.actions.length, count, 'no new actions');
  assert.equal(fake.getState(), stateAfterFirst);
  assert.match(result, /already seeded/);
  assert.match(result, /nothing created/);
});

test('throws a clear error without __e2eTestHelpers', async () => {
  await assert.rejects(runSeed({ __teamShotSeedMaxWaitMs: 0 }), /__e2eTestHelpers is missing/);
});

test('throws when the app data never finishes loading', async () => {
  const fake = createFakeWindow();
  fake.getState().tasks.isDataLoaded = false;
  await assert.rejects(runSeed(fake.win), /did not finish loading/);
  assert.equal(fake.actions.length, 0);
});
