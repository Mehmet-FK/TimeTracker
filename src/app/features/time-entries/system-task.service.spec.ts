import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { selectTaskEntities } from '../tasks/store/task.selectors';
import { selectProjectFeatureState } from '../project/store/project.selectors';
import { addProject } from '../project/store/project.actions';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { SystemTaskService } from './system-task.service';
import {
  SYSTEM_PROJECT_ID,
  SYSTEM_TASK_ID,
  SYSTEM_TASK_TITLE,
} from './system-task.const';

describe('SystemTaskService', () => {
  let service: SystemTaskService;
  let store: MockStore;
  let dispatchSpy: jasmine.Spy;

  const setState = (hasProject: boolean, hasTask: boolean): void => {
    store.overrideSelector(selectProjectFeatureState, {
      ids: hasProject ? [SYSTEM_PROJECT_ID] : [],
      entities: hasProject ? { [SYSTEM_PROJECT_ID]: { id: SYSTEM_PROJECT_ID } } : {},
    } as any);
    store.overrideSelector(
      selectTaskEntities,
      hasTask ? { [SYSTEM_TASK_ID]: { id: SYSTEM_TASK_ID } as Task } : {},
    );
    store.refreshState();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SystemTaskService,
        provideMockStore(),
        {
          provide: TaskService,
          useValue: {
            createNewTaskWithDefaults: ({ id, title, workContextId }: any) => ({
              ...DEFAULT_TASK,
              id,
              title,
              projectId: workContextId,
            }),
          },
        },
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: of(true) },
        },
      ],
    });
    store = TestBed.inject(MockStore);
    dispatchSpy = spyOn(store, 'dispatch');
    service = TestBed.inject(SystemTaskService);
  });

  it('creates the hidden project and the task when missing', () => {
    setState(false, false);

    service.ensureExists();

    const actions = dispatchSpy.calls.allArgs().map(([a]) => a);
    expect(actions[0].type).toBe(addProject.type);
    expect(actions[0].project).toEqual(
      jasmine.objectContaining({ id: SYSTEM_PROJECT_ID, isHiddenFromMenu: true }),
    );
    expect(actions[1].type).toBe(TaskSharedActions.addTask.type);
    expect(actions[1].task).toEqual(
      jasmine.objectContaining({
        id: SYSTEM_TASK_ID,
        title: SYSTEM_TASK_TITLE,
        projectId: SYSTEM_PROJECT_ID,
      }),
    );
  });

  it('does nothing when both exist', () => {
    setState(true, true);

    service.ensureExists();

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('recreates only the task when it is missing', () => {
    setState(true, false);

    service.ensureExists();

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.calls.first().args[0].type).toBe(TaskSharedActions.addTask.type);
  });

  it('runs once the data is loaded', () => {
    setState(true, true);
    const ensureSpy = spyOn(service, 'ensureExists');

    service.init();

    expect(ensureSpy).toHaveBeenCalledTimes(1);
  });
});
