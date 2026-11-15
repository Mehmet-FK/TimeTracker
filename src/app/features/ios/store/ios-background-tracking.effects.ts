import { inject, Injectable } from '@angular/core';
import { createEffect } from '@ngrx/effects';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MOBILE_BACKGROUND_IDLE_CAP_MS } from '../../../app.constants';
import { IS_IOS_NATIVE } from '../../../util/is-native-platform';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { TaskService } from '../../tasks/task.service';
import { iosInterface } from '../ios-interface';

/**
 * Credit the wall-clock gap (capped) to the active task, reset the tracking
 * anchor so the next 1 s interval tick doesn't double-count any uncapped
 * remainder, then flush accumulated time.
 *
 * Pause persistence is handled in `main.ts`'s `appStateChange` listener inside
 * the `BackgroundTask.beforeExit` budget — this effect only handles resume.
 *
 * Exported as a plain function so the spec can drive it directly without
 * tripping the `IS_IOS_NATIVE` gate on `createEffect`.
 */
export const handleIosResume = (
  globalTracking: GlobalTrackingIntervalService,
  taskService: TaskService,
): void => {
  globalTracking.triggerWakeUpTick(MOBILE_BACKGROUND_IDLE_CAP_MS);
  globalTracking.resetTrackingStart();
  taskService.flushAccumulatedTimeSpent();
};

/**
 * Wire a resume stream to the reconciliation handler. Exported (and
 * effect-independent) so the spec can drive the full pipe without tripping the
 * `IS_IOS_NATIVE` gate on `createEffect`.
 */
export const reconcileOnResume = (
  onResume$: Observable<void>,
  globalTracking: GlobalTrackingIntervalService,
  taskService: TaskService,
): Observable<unknown> =>
  onResume$.pipe(tap(() => handleIosResume(globalTracking, taskService)));

@Injectable()
export class IosBackgroundTrackingEffects {
  private _taskService = inject(TaskService);
  private _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);

  reconcileOnResume$ =
    IS_IOS_NATIVE &&
    createEffect(
      () =>
        reconcileOnResume(
          iosInterface.onResume$,
          this._globalTrackingIntervalService,
          this._taskService,
        ),
      { dispatch: false },
    );
}
