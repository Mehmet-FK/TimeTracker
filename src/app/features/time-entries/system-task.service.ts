import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { first } from 'rxjs/operators';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { selectProjectFeatureState } from '../project/store/project.selectors';
import { addProject } from '../project/store/project.actions';
import { DEFAULT_PROJECT } from '../project/project.const';
import { selectTaskEntities } from '../tasks/store/task.selectors';
import { TaskService } from '../tasks/task.service';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { WorkContextType } from '../work-context/work-context.model';
import {
  SYSTEM_PROJECT_ID,
  SYSTEM_PROJECT_TITLE,
  SYSTEM_TASK_ID,
  SYSTEM_TASK_TITLE,
} from './system-task.const';

/** Creates the hidden system project and the "Unassigned" task when missing. */
@Injectable({
  providedIn: 'root',
})
export class SystemTaskService {
  private readonly _store = inject(Store);
  private readonly _taskService = inject(TaskService);
  private readonly _dataInitStateService = inject(DataInitStateService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _projectState = this._store.selectSignal(selectProjectFeatureState);
  private readonly _taskEntities = this._store.selectSignal(selectTaskEntities);

  init(): void {
    this._dataInitStateService.isAllDataLoadedInitially$
      .pipe(first(), takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this.ensureExists());
  }

  ensureExists(): void {
    if (!this._projectState().entities[SYSTEM_PROJECT_ID]) {
      this._store.dispatch(
        addProject({
          project: {
            ...DEFAULT_PROJECT,
            id: SYSTEM_PROJECT_ID,
            title: SYSTEM_PROJECT_TITLE,
            isHiddenFromMenu: true,
          },
        }),
      );
    }
    if (!this._taskEntities()[SYSTEM_TASK_ID]) {
      const task = this._taskService.createNewTaskWithDefaults({
        id: SYSTEM_TASK_ID,
        title: SYSTEM_TASK_TITLE,
        workContextType: WorkContextType.PROJECT,
        workContextId: SYSTEM_PROJECT_ID,
      });
      this._store.dispatch(
        TaskSharedActions.addTask({
          task,
          workContextId: SYSTEM_PROJECT_ID,
          workContextType: WorkContextType.PROJECT,
          isAddToBacklog: false,
          isAddToBottom: true,
          // the title is ours, not user input
          isIgnoreShortSyntax: true,
        }),
      );
    }
  }
}
