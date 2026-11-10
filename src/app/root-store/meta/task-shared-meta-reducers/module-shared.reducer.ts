import { Action, ActionReducer, MetaReducer } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { RootState } from '../../root-state';
import { TaskSharedActions } from '../task-shared.actions';
import {
  TASK_FEATURE_NAME,
  taskAdapter,
} from '../../../features/tasks/store/task.reducer';
import { Task } from '../../../features/tasks/task.model';
import { GENERAL_MODULE_ID } from '../../../features/module/module.const';
import {
  deleteModule,
  linkOrphanTasksToGeneral,
} from '../../../features/module/store/module.actions';

/**
 * Guarantees that every task has at least one module: a task without any is
 * linked to GENERAL (never rejected). Runs after the task CRUD meta-reducer, so
 * a task that was just added or edited is already in the state.
 */

const linkToGeneral = (state: RootState, taskIds?: string[]): RootState => {
  const taskState = state[TASK_FEATURE_NAME];
  const candidates = taskIds ?? (taskState.ids as string[]);
  const updates: Update<Task>[] = [];
  for (const id of candidates) {
    const task = taskState.entities[id];
    if (task && !task.moduleIds?.length) {
      updates.push({ id, changes: { moduleIds: [GENERAL_MODULE_ID] } });
    }
  }
  if (!updates.length) return state;
  return {
    ...state,
    [TASK_FEATURE_NAME]: taskAdapter.updateMany(updates, taskState),
  };
};

// Safety net: ModuleService.delete blocks deleting a module that still has tasks,
// so this only matters for a deleteModule op arriving from sync.
const handleDeleteModule = (state: RootState, moduleId: string): RootState => {
  // GENERAL cannot be deleted; the module reducer rejects the action.
  if (moduleId === GENERAL_MODULE_ID) return state;
  const taskState = state[TASK_FEATURE_NAME];
  const updates: Update<Task>[] = [];
  for (const task of Object.values(taskState.entities)) {
    if (!task?.moduleIds?.includes(moduleId)) continue;
    const remaining = task.moduleIds.filter((id) => id !== moduleId);
    updates.push({
      id: task.id,
      changes: { moduleIds: remaining.length ? remaining : [GENERAL_MODULE_ID] },
    });
  }
  if (!updates.length) return state;
  return {
    ...state,
    [TASK_FEATURE_NAME]: taskAdapter.updateMany(updates, taskState),
  };
};

export const moduleSharedMetaReducer: MetaReducer = (
  reducer: ActionReducer<any, Action>,
) => {
  return (state: unknown, action: Action) => {
    if (!state) return reducer(state, action);

    const rootState = state as RootState;
    let updatedState = rootState;
    switch (action.type) {
      case TaskSharedActions.addTask.type:
        updatedState = linkToGeneral(rootState, [
          (action as ReturnType<typeof TaskSharedActions.addTask>).task.id,
        ]);
        break;
      case TaskSharedActions.updateTask.type:
        updatedState = linkToGeneral(rootState, [
          (action as ReturnType<typeof TaskSharedActions.updateTask>).task.id as string,
        ]);
        break;
      case linkOrphanTasksToGeneral.type:
        updatedState = linkToGeneral(rootState);
        break;
      case deleteModule.type:
        updatedState = handleDeleteModule(
          rootState,
          (action as ReturnType<typeof deleteModule>).id,
        );
        break;
    }
    return reducer(updatedState, action);
  };
};
