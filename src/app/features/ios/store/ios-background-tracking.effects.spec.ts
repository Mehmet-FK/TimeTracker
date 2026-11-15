import { Subject, Subscription } from 'rxjs';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { TaskService } from '../../tasks/task.service';
import { MOBILE_BACKGROUND_IDLE_CAP_MS } from '../../../app.constants';
import { handleIosResume, reconcileOnResume } from './ios-background-tracking.effects';

// Effect creation is gated by IS_IOS_NATIVE (false under Karma), so the spec
// drives the handler body directly. Mirrors the precedent in
// android-foreground-tracking.effects.spec.ts.

describe('IosBackgroundTrackingEffects', () => {
  let globalTracking: jasmine.SpyObj<GlobalTrackingIntervalService>;
  let taskService: jasmine.SpyObj<TaskService>;

  beforeEach(() => {
    globalTracking = jasmine.createSpyObj('GlobalTrackingIntervalService', [
      'triggerWakeUpTick',
      'resetTrackingStart',
    ]);
    globalTracking.triggerWakeUpTick.and.returnValue({
      duration: 0,
      date: '2026-05-27',
      timestamp: Date.now(),
    });
    taskService = jasmine.createSpyObj('TaskService', ['flushAccumulatedTimeSpent']);
  });

  describe('handleIosResume', () => {
    it('triggers wake-up tick with the configured cap then resets the anchor', () => {
      const callOrder: string[] = [];
      globalTracking.triggerWakeUpTick.and.callFake(() => {
        callOrder.push('wakeUp');
        return { duration: 0, date: '2026-05-27', timestamp: Date.now() };
      });
      globalTracking.resetTrackingStart.and.callFake(() => callOrder.push('reset'));
      taskService.flushAccumulatedTimeSpent.and.callFake(() => callOrder.push('flush'));

      handleIosResume(globalTracking, taskService);

      expect(globalTracking.triggerWakeUpTick).toHaveBeenCalledOnceWith(
        MOBILE_BACKGROUND_IDLE_CAP_MS,
      );
      expect(callOrder).toEqual(['wakeUp', 'reset', 'flush']);
    });
  });

  // Covers the effect pipe itself (onResume$ → handler). The effect field is
  // `false` under Karma (IS_IOS_NATIVE gate), so we exercise the extracted
  // `reconcileOnResume` factory directly.
  describe('reconcileOnResume (effect wiring)', () => {
    let onResume$: Subject<void>;
    let sub: Subscription;

    beforeEach(() => {
      onResume$ = new Subject<void>();
    });

    afterEach(() => sub?.unsubscribe());

    it('reconciles tracked time on each resume', () => {
      sub = reconcileOnResume(onResume$, globalTracking, taskService).subscribe();

      onResume$.next();
      onResume$.next();

      expect(globalTracking.triggerWakeUpTick).toHaveBeenCalledWith(
        MOBILE_BACKGROUND_IDLE_CAP_MS,
      );
      expect(globalTracking.triggerWakeUpTick).toHaveBeenCalledTimes(2);
      expect(taskService.flushAccumulatedTimeSpent).toHaveBeenCalledTimes(2);
    });
  });
});
