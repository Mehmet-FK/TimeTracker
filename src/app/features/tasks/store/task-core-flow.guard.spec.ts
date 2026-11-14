/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Guard for TT-35: the core task and time-tracking flows must keep working
 * while unused features (issue providers, pomodoro, focus mode, ...) are
 * removed. Runs the real task/project/tag/time-tracking reducers behind the
 * real task-shared CRUD meta-reducer; no issue/pomodoro/focus-mode code.
 */
import { Action, ActionReducer } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { TASK_FEATURE_NAME, taskReducer } from './task.reducer';
import { setCurrentTask, unsetCurrentTask } from './task.actions';
import {
  PROJECT_FEATURE_NAME,
  projectReducer,
} from '../../project/store/project.reducer';
import { TAG_FEATURE_NAME, tagReducer } from '../../tag/store/tag.reducer';
import {
  TIME_TRACKING_FEATURE_KEY,
  timeTrackingReducer,
} from '../../time-tracking/store/time-tracking.reducer';
import { TimeTrackingActions } from '../../time-tracking/store/time-tracking.actions';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';
import { taskSharedCrudMetaReducer } from '../../../root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer';
import {
  createBaseState,
  createMockTask,
} from '../../../root-store/meta/task-shared-meta-reducers/test-utils';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { RootState } from '../../../root-store/root-state';
import { Task, TaskWithSubTasks, TimeEntry } from '../task.model';
import { Project } from '../../project/project.model';
import { Tag } from '../../tag/tag.model';
import { WorkContextType } from '../../work-context/work-context.model';
import { initialTimeTrackingState } from '../../time-tracking/store/time-tracking.reducer';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { AppDataComplete } from '../../../op-log/model/model-config';
import { dataRepair } from '../../../op-log/validation/data-repair';
import { stripRemovedFeatureData } from '../../../op-log/validation/strip-removed-feature-data';
import {
  createCleanAppData,
  createOldAppDataWithRemovedFeatures,
} from '../../../op-log/validation/test-fixtures/removed-feature-data.fixture';

type State = RootState & Record<string, unknown>;

const featureReducers: ActionReducer<State, Action> = (state, action) => {
  const s = state as State;
  return {
    ...s,
    [TASK_FEATURE_NAME]: taskReducer(s[TASK_FEATURE_NAME], action),
    [PROJECT_FEATURE_NAME]: projectReducer(s[PROJECT_FEATURE_NAME], action),
    [TAG_FEATURE_NAME]: tagReducer(s[TAG_FEATURE_NAME], action),
    [TIME_TRACKING_FEATURE_KEY]: timeTrackingReducer(
      s[TIME_TRACKING_FEATURE_KEY] as typeof initialTimeTrackingState,
      action,
    ),
  } as State;
};

const reducer = taskSharedCrudMetaReducer(featureReducers) as ActionReducer<
  State,
  Action
>;

const HOUR = 60 * 60 * 1000;

describe('Task core flows (TT-35 guard)', () => {
  let state: State;

  const run = (...actions: Action[]): void => {
    actions.forEach((a) => (state = reducer(state, a)));
  };
  const task = (id: string): Task => state[TASK_FEATURE_NAME].entities[id] as Task;
  const project = (id: string): Project =>
    state[PROJECT_FEATURE_NAME].entities[id] as Project;
  const tag = (id: string): Tag => state[TAG_FEATURE_NAME].entities[id] as Tag;

  const addTask = (overrides: Partial<Task>): void =>
    run(
      TaskSharedActions.addTask({
        task: createMockTask(overrides),
        workContextId: overrides.projectId ?? 'project1',
        workContextType: WorkContextType.PROJECT,
        isAddToBottom: true,
        isAddToBacklog: false,
      }),
    );
  const updateTask = (update: Update<Task>): void =>
    run(TaskSharedActions.updateTask({ task: update }));
  const deleteTask = (id: string): void => {
    const t = task(id);
    const subTasks = t.subTaskIds.map((sid) => task(sid));
    run(TaskSharedActions.deleteTask({ task: { ...t, subTasks } as TaskWithSubTasks }));
  };

  /**
   * What tracking does: start (setCurrentTask), one tick per interval
   * (addTimeSpent), stop (unsetCurrentTask) and storing the tracked period
   * as a time entry (TimeEntryService.addTrackedEntry -> updateTask).
   */
  const trackTime = (id: string, start: number, ticks: number[]): TimeEntry => {
    run(setCurrentTask({ id }));
    expect(state[TASK_FEATURE_NAME].currentTaskId).toBe(id);
    const day = getDbDateStr(start);
    ticks.forEach((duration) =>
      run(
        TimeTrackingActions.addTimeSpent({
          task: task(id),
          date: day,
          duration,
          isFromTrackingReminder: false,
        }),
      ),
    );
    run(unsetCurrentTask());
    expect(state[TASK_FEATURE_NAME].currentTaskId).toBeNull();
    const total = ticks.reduce((a, b) => a + b, 0);
    const entry: TimeEntry = { id: `entry-${id}-${start}`, start, end: start + total };
    updateTask({
      id,
      changes: { timeEntries: [...(task(id).timeEntries || []), entry] },
    });
    return entry;
  };

  const coreFlows = (projectId: string, tagId: string): void => {
    it('adds a task to its project and tag', () => {
      addTask({ id: 'new1', title: 'New', projectId, tagIds: [tagId] });
      expect(task('new1').title).toBe('New');
      expect(project(projectId).taskIds).toContain('new1');
      expect(tag(tagId).taskIds).toContain('new1');
    });

    it('edits title, notes and done', () => {
      addTask({ id: 'new1', title: 'New', projectId, tagIds: [tagId] });
      updateTask({ id: 'new1', changes: { title: 'Renamed', notes: 'Some notes' } });
      updateTask({ id: 'new1', changes: { isDone: true } });
      expect(task('new1').title).toBe('Renamed');
      expect(task('new1').notes).toBe('Some notes');
      expect(task('new1').isDone).toBe(true);
      updateTask({ id: 'new1', changes: { isDone: false } });
      expect(task('new1').isDone).toBe(false);
    });

    it('deletes a task with its subtask and its project and tag references', () => {
      addTask({ id: 'new1', projectId, tagIds: [tagId] });
      run(
        TaskSharedActions.addTask({
          task: createMockTask({
            id: 'new1sub',
            projectId,
            tagIds: [],
            parentId: 'new1',
          }),
          workContextId: projectId,
          workContextType: WorkContextType.PROJECT,
          isAddToBottom: true,
          isAddToBacklog: false,
        }),
      );
      updateTask({ id: 'new1', changes: { subTaskIds: ['new1sub'] } });

      deleteTask('new1');

      expect(state[TASK_FEATURE_NAME].entities['new1']).toBeUndefined();
      expect(state[TASK_FEATURE_NAME].entities['new1sub']).toBeUndefined();
      expect(state[TASK_FEATURE_NAME].ids).not.toContain('new1');
      expect(project(projectId).taskIds).not.toContain('new1');
      expect(tag(tagId).taskIds).not.toContain('new1');
    });

    it('starts and stops time tracking and writes timeSpentOnDay and timeEntries', () => {
      addTask({ id: 'new1', projectId, tagIds: [tagId] });
      const start = Date.now() - HOUR;
      const day = getDbDateStr(start);

      const entry = trackTime('new1', start, [1000, 1000, 30 * 60 * 1000]);

      const t = task('new1');
      expect(t.timeSpentOnDay[day]).toBe(2000 + 30 * 60 * 1000);
      expect(t.timeSpent).toBe(2000 + 30 * 60 * 1000);
      expect(t.timeEntries).toEqual([entry]);
    });
  };

  describe('on fresh state', () => {
    beforeEach(() => {
      const base = createBaseState() as State;
      state = { ...base, [TIME_TRACKING_FEATURE_KEY]: initialTimeTrackingState } as State;
    });

    coreFlows('project1', 'tag1');
  });

  describe('after loading cleaned old data with removed features', () => {
    let loaded: AppDataComplete;

    beforeEach(() => {
      const old = createOldAppDataWithRemovedFeatures() as unknown as AppDataComplete;
      loaded = stripRemovedFeatureData(
        dataRepair(old).data as unknown as Record<string, unknown>,
      ) as unknown as AppDataComplete;
      const base = createBaseState() as State;
      state = { ...base, [TIME_TRACKING_FEATURE_KEY]: initialTimeTrackingState } as State;
      run(loadAllData({ appDataComplete: loaded }));
    });

    it('loads every task, project and tag unchanged', () => {
      const clean = createCleanAppData();
      expect(state[TASK_FEATURE_NAME].ids).toEqual(clean.task.ids);
      clean.task.ids.forEach((id) => {
        const t = task(id);
        expect(t).toEqual(jasmine.objectContaining(clean.task.entities[id] as Task));
        expect(t.issueId).toBeUndefined();
        expect(t.issueType).toBeUndefined();
      });
      expect(project('P1').taskIds).toEqual(['t1', 't3']);
      expect(tag('TG1').taskIds).toEqual(['t1', 't3']);
    });

    coreFlows('P1', 'TG1');

    it('edits, tracks and deletes a formerly issue-linked task', () => {
      updateTask({ id: 't1', changes: { title: 'Was a Jira issue', isDone: true } });
      expect(task('t1').title).toBe('Was a Jira issue');
      expect(task('t1').isDone).toBe(true);
      updateTask({ id: 't1', changes: { isDone: false } });

      const oldEntries = task('t1').timeEntries!;
      const start = Date.now() - HOUR;
      const day = getDbDateStr(start);
      const before = task('t1').timeSpentOnDay[day] || 0;
      // a parent with subtasks tracks the first undone subtask; track t3 instead
      const entry = trackTime('t3', start, [5000]);
      expect(task('t3').timeSpentOnDay[day]).toBe(5000);
      expect(task('t3').timeEntries).toEqual([entry]);
      expect(task('t1').timeEntries).toEqual(oldEntries);
      expect(task('t1').timeSpentOnDay[day] || 0).toBe(before);

      deleteTask('t1');
      expect(state[TASK_FEATURE_NAME].entities['t1']).toBeUndefined();
      expect(state[TASK_FEATURE_NAME].entities['t1sub']).toBeUndefined();
      expect(project('P1').taskIds).toEqual(['t3']);
      expect(tag('TG1').taskIds).toEqual(['t3']);
      expect(task('t2')).toBeDefined();
    });
  });
});
