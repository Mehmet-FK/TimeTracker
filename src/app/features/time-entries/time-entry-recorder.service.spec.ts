import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { ReplaySubject, Subject } from 'rxjs';
import { selectCurrentTaskId } from '../tasks/store/task.selectors';
import { selectIdleTime, selectIsIdle } from '../idle/store/idle.selectors';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { TimeEntryService } from './time-entry.service';
import { TimeEntryRecorderService } from './time-entry-recorder.service';
import { LS } from '../../core/persistence/storage-keys.const';

const MOCK_SELECTORS = [
  { selector: selectCurrentTaskId, value: null },
  { selector: selectIsIdle, value: false },
  { selector: selectIdleTime, value: 0 },
];

describe('TimeEntryRecorderService', () => {
  let service: TimeEntryRecorderService;
  let store: MockStore;
  let timeEntryService: jasmine.SpyObj<TimeEntryService>;
  let tick$: Subject<unknown>;
  let dataLoaded$: ReplaySubject<boolean>;

  const setCurrentTaskId = (id: string | null): void => {
    store.overrideSelector(selectCurrentTaskId, id);
    store.refreshState();
  };

  beforeEach(() => {
    localStorage.removeItem(LS.OPEN_TIME_ENTRY_SESSION);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 10, 9, 0, 0));

    timeEntryService = jasmine.createSpyObj<TimeEntryService>('TimeEntryService', [
      'addTrackedEntry',
    ]);
    timeEntryService.addTrackedEntry.and.resolveTo();
    tick$ = new Subject();
    dataLoaded$ = new ReplaySubject<boolean>(1);

    TestBed.configureTestingModule({
      providers: [
        TimeEntryRecorderService,
        provideMockStore({ selectors: MOCK_SELECTORS }),
        { provide: TimeEntryService, useValue: timeEntryService },
        { provide: GlobalTrackingIntervalService, useValue: { tick$ } },
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: dataLoaded$ },
        },
      ],
    });
    store = TestBed.inject(MockStore);
    service = TestBed.inject(TimeEntryRecorderService);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.removeItem(LS.OPEN_TIME_ENTRY_SESSION);
  });

  const start = new Date(2026, 9, 10, 9, 0, 0).getTime();
  const advance = (ms: number): void => jasmine.clock().tick(ms);
  const after = (ms: number): number => start + ms;

  it('stores an entry when tracking stops', () => {
    service.init();
    dataLoaded$.next(true);

    setCurrentTaskId('t1');
    advance(30 * 60 * 1000);
    setCurrentTaskId(null);

    expect(timeEntryService.addTrackedEntry).toHaveBeenCalledOnceWith(
      't1',
      start,
      after(30 * 60 * 1000),
    );
    expect(service.openSession()).toBeNull();
    expect(localStorage.getItem(LS.OPEN_TIME_ENTRY_SESSION)).toBeNull();
  });

  it('closes the previous entry and opens a new one when switching tasks', () => {
    service.init();
    dataLoaded$.next(true);

    setCurrentTaskId('t1');
    advance(10 * 60 * 1000);
    setCurrentTaskId('t2');

    expect(timeEntryService.addTrackedEntry).toHaveBeenCalledOnceWith(
      't1',
      start,
      after(10 * 60 * 1000),
    );
    expect(service.openSession()).toEqual(
      jasmine.objectContaining({ taskId: 't2', start: after(10 * 60 * 1000) }),
    );
  });

  it('ends the entry when the user became idle', () => {
    service.init();
    dataLoaded$.next(true);

    setCurrentTaskId('t1');
    advance(30 * 60 * 1000);
    // idle handling unsets the current task while the idle state is set
    store.overrideSelector(selectIsIdle, true);
    store.overrideSelector(selectIdleTime, 10 * 60 * 1000);
    setCurrentTaskId(null);

    expect(timeEntryService.addTrackedEntry).toHaveBeenCalledOnceWith(
      't1',
      start,
      after(20 * 60 * 1000),
    );
  });

  it('does not store accidental sessions shorter than a second', () => {
    service.init();
    dataLoaded$.next(true);

    setCurrentTaskId('t1');
    advance(500);
    setCurrentTaskId(null);

    expect(timeEntryService.addTrackedEntry).not.toHaveBeenCalled();
  });

  it('persists the open session and stores it after a restart', () => {
    service.init();
    dataLoaded$.next(true);
    setCurrentTaskId('t1');
    advance(20 * 1000);
    tick$.next({});

    const persisted = JSON.parse(
      localStorage.getItem(LS.OPEN_TIME_ENTRY_SESSION) as string,
    );
    expect(persisted).toEqual({ taskId: 't1', start, lastSeen: after(20 * 1000) });

    // simulate a restart: a fresh service instance reads the persisted session
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TimeEntryRecorderService,
        provideMockStore({ selectors: MOCK_SELECTORS }),
        { provide: TimeEntryService, useValue: timeEntryService },
        { provide: GlobalTrackingIntervalService, useValue: { tick$: new Subject() } },
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: dataLoaded$ },
        },
      ],
    });
    TestBed.inject(TimeEntryRecorderService).init();

    expect(timeEntryService.addTrackedEntry).toHaveBeenCalledOnceWith(
      't1',
      start,
      after(20 * 1000),
    );
    expect(localStorage.getItem(LS.OPEN_TIME_ENTRY_SESSION)).toBeNull();
  });

  it('waits for the data to be loaded', () => {
    service.init();
    setCurrentTaskId('t1');
    expect(service.openSession()).toBeNull();

    dataLoaded$.next(true);
    expect(service.openSession()).toEqual(jasmine.objectContaining({ taskId: 't1' }));
  });
});
