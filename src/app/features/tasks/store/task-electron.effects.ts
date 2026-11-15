import { inject, Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { setCurrentTask, unsetCurrentTask } from './task.actions';
import { select, Store } from '@ngrx/store';
import { take, tap, throttleTime, withLatestFrom } from 'rxjs/operators';
import { selectCurrentTask, selectTaskEntities } from './task.selectors';
import { selectTodayTaskIds } from '../../work-context/store/work-context.selectors';
import { GlobalConfigService } from '../../config/global-config.service';
import { TimeTrackingActions } from '../../time-tracking/store/time-tracking.actions';
import { Task } from '../task.model';
import { IPC } from '../../../../../electron/shared-with-frontend/ipc-events.const';
import { TaskService } from '../task.service';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';

// TODO send message to electron when current task changes here

@Injectable()
export class TaskElectronEffects {
  private _actions$ = inject(LOCAL_ACTIONS);
  private _store$ = inject<Store<any>>(Store);
  private _configService = inject(GlobalConfigService);
  private _taskService = inject(TaskService);

  // -----------------------------------------------------------------------------------
  // NOTE: IS_ELECTRON checks not necessary, since we check before importing this module
  // -----------------------------------------------------------------------------------

  constructor() {
    /**
     * SYNC-SAFE: This IPC listener is safe during sync/hydration because:
     * - Read-only operation - only reads current state and sends to Electron
     * - No store mutations or action dispatches
     * - Responds to explicit IPC request, not store-change driven
     * - take(1) ensures single response per request
     */
    window.ea.on(IPC.REQUEST_CURRENT_TASK_FOR_TASK_WIDGET, () => {
      this._store$
        .pipe(
          select(selectCurrentTask),
          // Only take the first value and complete
          take(1),
        )
        .subscribe((current) => {
          this._sendCurrentTask(current);
        });
    });

    window.ea.onSwitchTask((taskId) => {
      this._taskService.setCurrentId(taskId);
    });
  }

  syncTodayTasksToElectron$ = createEffect(
    () =>
      this._store$.pipe(
        select(selectTodayTaskIds),
        withLatestFrom(this._store$.pipe(select(selectTaskEntities))),
        tap(([todayTaskIds, taskEntities]) => {
          const tasks = todayTaskIds
            .map((id) => taskEntities[id])
            .filter((t) => !!t && !t.isDone)
            .map((t) => ({
              id: t!.id,
              title: t!.title,
              timeEstimate: t!.timeEstimate,
              timeSpent: t!.timeSpent,
            }));
          window.ea.updateTodayTasks(tasks);
        }),
      ),
    { dispatch: false },
  );

  taskChangeElectron$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(setCurrentTask, unsetCurrentTask, TimeTrackingActions.addTimeSpent),
        // Leading+trailing keeps immediate feedback for setCurrentTask while
        // capping the per-second addTimeSpent stream at ~1 IPC per window.
        throttleTime(500, undefined, { leading: true, trailing: true }),
        withLatestFrom(this._store$.pipe(select(selectCurrentTask))),
        tap(([, current]) => {
          this._sendCurrentTask(current);
        }),
      ),
    { dispatch: false },
  );

  setTaskBarNoProgress$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(setCurrentTask),
        tap(({ id }) => {
          if (!id) {
            window.ea.setProgressBar({
              progress: -1,
              progressBarMode: 'none',
            });
          }
        }),
      ),
    { dispatch: false },
  );

  clearTaskBarOnTaskDone$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(TaskSharedActions.updateTask),
        tap(({ task }) => {
          if (task.changes.isDone) {
            window.ea.setProgressBar({
              progress: -1,
              progressBarMode: 'none',
            });
          }
        }),
      ),
    { dispatch: false },
  );

  setTaskBarProgress$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(TimeTrackingActions.addTimeSpent),
        // The OS taskbar progress bar moves imperceptibly per second; throttling
        // collapses 1 IPC/sec into ~1 IPC/3s. Leading+trailing keeps the first
        // tick after start instant and the final value at the end of a window.
        throttleTime(3000, undefined, { leading: true, trailing: true }),
        tap(({ task }) => {
          const progress = task.timeSpent / task.timeEstimate;
          window.ea.setProgressBar({
            progress,
            progressBarMode: 'normal',
          });
        }),
      ),
    { dispatch: false },
  );

  private _sendCurrentTask(current: Task | null): void {
    window.ea.updateCurrentTask(
      current,
      // The four session arguments below are legacy IPC slots: always off/0.
      false,
      0,
      false,
      0,
    );
  }
}
