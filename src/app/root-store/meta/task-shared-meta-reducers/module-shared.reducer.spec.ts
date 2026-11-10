import { Action } from '@ngrx/store';
import { TaskSharedActions } from '../task-shared.actions';
import {
  TASK_FEATURE_NAME,
  taskAdapter,
} from '../../../features/tasks/store/task.reducer';
import { DEFAULT_TASK, Task } from '../../../features/tasks/task.model';
import { WorkContextType } from '../../../features/work-context/work-context.model';
import { GENERAL_MODULE_ID } from '../../../features/module/module.const';
import {
  deleteModule,
  linkOrphanTasksToGeneral,
} from '../../../features/module/store/module.actions';
import { moduleSharedMetaReducer } from './module-shared.reducer';

describe('moduleSharedMetaReducer', () => {
  const mkTask = (id: string, moduleIds?: string[]): Task =>
    ({ ...DEFAULT_TASK, id, projectId: 'p', moduleIds }) as Task;

  const mkState = (tasks: Task[]): any => ({
    [TASK_FEATURE_NAME]: taskAdapter.setAll(tasks, taskAdapter.getInitialState()),
  });

  // inner reducer returns the state it receives, so we see the meta-reducer's effect
  const run = (state: any, action: Action): any =>
    moduleSharedMetaReducer((s: any) => s)(state, action);

  const moduleIdsOf = (state: any, id: string): string[] | undefined =>
    state[TASK_FEATURE_NAME].entities[id]?.moduleIds;

  const addTaskAction = (task: Task): Action =>
    TaskSharedActions.addTask({
      task,
      workContextId: 'p',
      workContextType: WorkContextType.PROJECT,
      isAddToBacklog: false,
      isAddToBottom: true,
    });

  it('links a task created without a module to GENERAL', () => {
    const state = mkState([mkTask('t1')]);
    expect(moduleIdsOf(run(state, addTaskAction(mkTask('t1'))), 't1')).toEqual([
      GENERAL_MODULE_ID,
    ]);
  });

  it('links a task created with an empty module list to GENERAL', () => {
    const state = mkState([mkTask('t1', [])]);
    expect(moduleIdsOf(run(state, addTaskAction(mkTask('t1', []))), 't1')).toEqual([
      GENERAL_MODULE_ID,
    ]);
  });

  it('keeps the modules of a task created with several (multi-module)', () => {
    const state = mkState([mkTask('t1', ['a', 'b'])]);
    expect(
      moduleIdsOf(run(state, addTaskAction(mkTask('t1', ['a', 'b']))), 't1'),
    ).toEqual(['a', 'b']);
  });

  it('links a task to GENERAL when an edit removed all its modules', () => {
    // state as left by the task CRUD meta-reducer: update already applied
    const state = mkState([mkTask('t1', [])]);
    const action = TaskSharedActions.updateTask({
      task: { id: 't1', changes: { moduleIds: [] } },
    });
    expect(moduleIdsOf(run(state, action), 't1')).toEqual([GENERAL_MODULE_ID]);
  });

  it('keeps modules assigned by an edit', () => {
    const state = mkState([mkTask('t1', ['a', 'b'])]);
    const action = TaskSharedActions.updateTask({
      task: { id: 't1', changes: { moduleIds: ['a', 'b'] } },
    });
    expect(moduleIdsOf(run(state, action), 't1')).toEqual(['a', 'b']);
  });

  it('a module can hold many tasks and a task many modules', () => {
    const state = mkState([mkTask('t1', ['a', 'b']), mkTask('t2', ['a'])]);
    const result = run(state, deleteModule({ id: 'b' }));
    expect(moduleIdsOf(result, 't1')).toEqual(['a']);
    expect(moduleIdsOf(result, 't2')).toEqual(['a']);
  });

  // ModuleService.delete refuses while tasks are linked; this reducer behavior is
  // only a safety net for a deleteModule op arriving from sync.
  it('safety net (sync): on module delete links tasks left without a module to GENERAL', () => {
    const state = mkState([
      mkTask('only', ['a']),
      mkTask('both', ['a', 'b']),
      mkTask('other', ['b']),
    ]);
    const result = run(state, deleteModule({ id: 'a' }));
    expect(moduleIdsOf(result, 'only')).toEqual([GENERAL_MODULE_ID]);
    expect(moduleIdsOf(result, 'both')).toEqual(['b']);
    expect(moduleIdsOf(result, 'other')).toEqual(['b']);
  });

  it('does not touch tasks when GENERAL delete is requested', () => {
    const state = mkState([mkTask('t1', [GENERAL_MODULE_ID])]);
    const result = run(state, deleteModule({ id: GENERAL_MODULE_ID }));
    expect(result).toBe(state);
  });

  it('backfill: links every task without a module, keeps the others', () => {
    const state = mkState([mkTask('a'), mkTask('b', []), mkTask('c', ['m'])]);
    const result = run(state, linkOrphanTasksToGeneral());
    expect(moduleIdsOf(result, 'a')).toEqual([GENERAL_MODULE_ID]);
    expect(moduleIdsOf(result, 'b')).toEqual([GENERAL_MODULE_ID]);
    expect(moduleIdsOf(result, 'c')).toEqual(['m']);
    const all = Object.values(result[TASK_FEATURE_NAME].entities) as Task[];
    expect(all.every((t) => (t.moduleIds?.length ?? 0) >= 1)).toBe(true);
  });

  it('backfill is idempotent', () => {
    const state = mkState([mkTask('a', [GENERAL_MODULE_ID])]);
    expect(run(state, linkOrphanTasksToGeneral())).toBe(state);
  });
});
