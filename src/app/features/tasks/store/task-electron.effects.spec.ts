import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { Subject } from 'rxjs';
import { TaskElectronEffects } from './task-electron.effects';
import { TimeTrackingActions } from '../../time-tracking/store/time-tracking.actions';
import { selectCurrentTask, selectTaskEntities } from './task.selectors';
import { selectTodayTaskIds } from '../../work-context/store/work-context.selectors';
import { GlobalConfigService } from '../../config/global-config.service';
import { TaskService } from '../task.service';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';
import { DEFAULT_TASK, Task } from '../task.model';
import { setCurrentTask } from './task.actions';

describe('TaskElectronEffects', () => {
  let effects: TaskElectronEffects;
  let actions$: Subject<any>;
  let store: MockStore;
  let setProgressBarSpy: jasmine.Spy;
  let updateCurrentTaskSpy: jasmine.Spy;

  const task: Task = {
    ...DEFAULT_TASK,
    id: 'T1',
    title: 'Task',
    projectId: 'project-1',
    timeSpent: 30 * 60000,
    timeEstimate: 60 * 60000,
  };

  const addTimeSpent = (): ReturnType<typeof TimeTrackingActions.addTimeSpent> =>
    TimeTrackingActions.addTimeSpent({
      task,
      date: '2026-01-05',
      duration: 1000,
      isFromTrackingReminder: false,
    });

  beforeEach(() => {
    actions$ = new Subject<any>();
    setProgressBarSpy = jasmine.createSpy('setProgressBar');
    updateCurrentTaskSpy = jasmine.createSpy('updateCurrentTask');
    (window as any).ea = {
      on: () => {},
      onSwitchTask: () => {},
      updateCurrentTask: updateCurrentTaskSpy,
      updateTodayTasks: () => {},
      setProgressBar: setProgressBarSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        TaskElectronEffects,
        provideMockActions(() => actions$),
        provideMockStore({
          selectors: [
            { selector: selectCurrentTask, value: task },
            { selector: selectTaskEntities, value: { T1: task } },
            { selector: selectTodayTaskIds, value: [] },
          ],
        }),
        { provide: LOCAL_ACTIONS, useValue: actions$ },
        { provide: GlobalConfigService, useValue: {} },
        { provide: TaskService, useValue: { setCurrentId: () => {} } },
      ],
    });

    effects = TestBed.inject(TaskElectronEffects);
    store = TestBed.inject(MockStore);
  });

  afterEach(() => {
    store.resetSelectors();
    delete (window as any).ea;
  });

  describe('setTaskBarProgress$', () => {
    it('should publish task progress on addTimeSpent', () => {
      const sub = effects.setTaskBarProgress$.subscribe();
      actions$.next(addTimeSpent());
      sub.unsubscribe();

      expect(setProgressBarSpy).toHaveBeenCalledWith({
        progress: 0.5,
        progressBarMode: 'normal',
      });
    });
  });

  describe('taskChangeElectron$', () => {
    it('should send the current task without focus-mode data', () => {
      const sub = effects.taskChangeElectron$.subscribe();
      actions$.next(setCurrentTask({ id: 'T1' }));
      sub.unsubscribe();

      expect(updateCurrentTaskSpy).toHaveBeenCalledWith(task, false, 0, false, 0);
    });
  });
});
