import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { TrackingReminderService } from './tracking-reminder.service';
import { IdleService } from '../idle/idle.service';
import { TaskService } from '../tasks/task.service';
import { GlobalConfigService } from '../config/global-config.service';
import { BannerService } from '../../core/banner/banner.service';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { DateService } from '../../core/date/date.service';
import { TakeABreakService } from '../take-a-break/take-a-break.service';
import { NotifyService } from '../../core/notify/notify.service';
import { UiHelperService } from '../ui-helper/ui-helper.service';
import { GlobalConfigState } from '../config/global-config.model';

const TRACKING_REMINDER_MIN_TIME = 5000;

const createMockCfg = (overrides: Partial<GlobalConfigState> = {}): GlobalConfigState =>
  ({
    timeTracking: {
      isTrackingReminderEnabled: true,
      isTrackingReminderShowOnMobile: true,
      trackingReminderMinTime: TRACKING_REMINDER_MIN_TIME,
      isAutoStartNextTask: false,
      isNotifyWhenTimeEstimateExceeded: false,
    },
    ...overrides,
  }) as any;

describe('TrackingReminderService', () => {
  let service: TrackingReminderService;
  let currentTaskId$: BehaviorSubject<string | null>;
  let isIdle$: BehaviorSubject<boolean>;
  let cfg$: BehaviorSubject<GlobalConfigState>;
  let sound$: BehaviorSubject<any>;

  beforeEach(() => {
    currentTaskId$ = new BehaviorSubject<string | null>(null);
    isIdle$ = new BehaviorSubject<boolean>(false);
    cfg$ = new BehaviorSubject<GlobalConfigState>(createMockCfg());
    sound$ = new BehaviorSubject<any>({ volume: 75 });

    TestBed.configureTestingModule({
      providers: [
        TrackingReminderService,
        {
          provide: IdleService,
          useValue: { isIdle$: isIdle$.asObservable() },
        },
        {
          provide: TaskService,
          useValue: { currentTaskId$: currentTaskId$.asObservable() },
        },
        {
          provide: GlobalConfigService,
          useValue: { cfg$: cfg$.asObservable(), sound$: sound$.asObservable() },
        },
        {
          provide: BannerService,
          useValue: {
            open: jasmine.createSpy('open'),
            dismiss: jasmine.createSpy('dismiss'),
          },
        },
        { provide: MatDialog, useValue: { openDialogs: [] } },
        {
          provide: TranslateService,
          useValue: {
            instant: jasmine.createSpy('instant').and.callFake((k: string) => k),
          },
        },
        { provide: DateService, useValue: { todayStr: () => '2024-01-19' } },
        {
          provide: TakeABreakService,
          useValue: { otherNoBreakTIme$: new BehaviorSubject<number>(0) },
        },
        {
          provide: NotifyService,
          useValue: { notify: jasmine.createSpy('notify') },
        },
        {
          provide: UiHelperService,
          useValue: {
            focusAppAfterNotification: jasmine.createSpy('focusAppAfterNotification'),
          },
        },
      ],
    });

    service = TestBed.inject(TrackingReminderService);
  });

  it('emits when nothing is tracked and the user is not idle', fakeAsync(() => {
    const values: number[] = [];
    const sub = service.remindCounter$.subscribe((v) => values.push(v));

    tick(TRACKING_REMINDER_MIN_TIME + 1000);
    expect(values.length).toBeGreaterThan(0);
    expect(values[values.length - 1]).toBeGreaterThan(TRACKING_REMINDER_MIN_TIME);

    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('is suppressed while a task is tracked', fakeAsync(() => {
    currentTaskId$.next('task-1');

    const values: number[] = [];
    const sub = service.remindCounter$.subscribe((v) => values.push(v));

    tick(TRACKING_REMINDER_MIN_TIME + 2000);
    expect(values.length).toBe(0);

    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('is suppressed while the user is idle', fakeAsync(() => {
    isIdle$.next(true);

    const values: number[] = [];
    const sub = service.remindCounter$.subscribe((v) => values.push(v));

    tick(TRACKING_REMINDER_MIN_TIME + 2000);
    expect(values.length).toBe(0);

    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('does not emit when the reminder is disabled', fakeAsync(() => {
    cfg$.next(
      createMockCfg({
        timeTracking: {
          ...createMockCfg().timeTracking,
          isTrackingReminderEnabled: false,
        },
      }),
    );

    const values: number[] = [];
    const sub = service.remindCounter$.subscribe((v) => values.push(v));

    tick(TRACKING_REMINDER_MIN_TIME + 2000);
    expect(values.length).toBe(0);

    sub.unsubscribe();
    discardPeriodicTasks();
  }));
});
