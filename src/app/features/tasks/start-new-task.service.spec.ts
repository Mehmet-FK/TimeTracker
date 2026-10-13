import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { StartNewTaskService } from './start-new-task.service';
import { TaskService } from './task.service';
import { T } from '../../t.const';
import { SystemTaskService } from '../time-entries/system-task.service';
import { SYSTEM_TASK_ID } from '../time-entries/system-task.const';
import {
  OpenTimeEntrySession,
  TimeEntryRecorderService,
} from '../time-entries/time-entry-recorder.service';
import { TimeEntryService } from '../time-entries/time-entry.service';

describe('StartNewTaskService', () => {
  let service: StartNewTaskService;
  let currentTaskId: ReturnType<typeof signal<string | null>>;
  let isTimeTrackingEnabled: ReturnType<typeof signal<boolean>>;
  let taskService: {
    currentTaskId: typeof currentTaskId;
    isTimeTrackingEnabled: typeof isTimeTrackingEnabled;
    toggleStartTask: jasmine.Spy;
    add: jasmine.Spy;
    setCurrentId: jasmine.Spy;
  };
  let matDialog: jasmine.SpyObj<MatDialog>;
  let systemTaskService: jasmine.SpyObj<SystemTaskService>;
  let recorder: {
    openSession: ReturnType<typeof signal<OpenTimeEntrySession | null>>;
    reassignOpenSession: jasmine.Spy;
  };
  let timeEntryService: jasmine.SpyObj<TimeEntryService>;

  const mockDialogResult = (result: string | undefined): void => {
    matDialog.open.and.returnValue({ afterClosed: () => of(result) } as any);
  };

  beforeEach(() => {
    currentTaskId = signal<string | null>(null);
    isTimeTrackingEnabled = signal(true);
    taskService = {
      currentTaskId,
      isTimeTrackingEnabled,
      toggleStartTask: jasmine.createSpy('toggleStartTask'),
      add: jasmine.createSpy('add').and.returnValue('new-task-id'),
      setCurrentId: jasmine.createSpy('setCurrentId'),
    };
    matDialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    systemTaskService = jasmine.createSpyObj<SystemTaskService>('SystemTaskService', [
      'ensureExists',
    ]);
    recorder = {
      openSession: signal<OpenTimeEntrySession | null>(null),
      reassignOpenSession: jasmine.createSpy('reassignOpenSession'),
    };
    timeEntryService = jasmine.createSpyObj<TimeEntryService>('TimeEntryService', [
      'moveTrackedTime',
    ]);
    timeEntryService.moveTrackedTime.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        StartNewTaskService,
        { provide: TaskService, useValue: taskService },
        { provide: MatDialog, useValue: matDialog },
        { provide: SystemTaskService, useValue: systemTaskService },
        { provide: TimeEntryRecorderService, useValue: recorder },
        { provide: TimeEntryService, useValue: timeEntryService },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => `translated:${key}` },
        },
      ],
    });
    service = TestBed.inject(StartNewTaskService);
  });

  it('stops the running task instead of creating a new one', () => {
    currentTaskId.set('running-task');

    service.toggleStartNewTask();

    expect(taskService.toggleStartTask).toHaveBeenCalledTimes(1);
    expect(matDialog.open).not.toHaveBeenCalled();
    expect(taskService.add).not.toHaveBeenCalled();
  });

  it('creates and starts a new task with the entered title', () => {
    mockDialogResult('  Write report  ');

    service.toggleStartNewTask();

    expect(matDialog.open).toHaveBeenCalledTimes(1);
    expect(taskService.add).toHaveBeenCalledOnceWith('Write report');
    expect(taskService.setCurrentId).toHaveBeenCalledOnceWith('new-task-id');
    expect(taskService.toggleStartTask).not.toHaveBeenCalled();
  });

  it('uses a fallback title when the entered title is empty', () => {
    mockDialogResult('   ');

    service.toggleStartNewTask();

    expect(taskService.add).toHaveBeenCalledOnceWith(
      `translated:${T.MH.NEW_TASK_NO_DESCRIPTION}`,
    );
    expect(taskService.setCurrentId).toHaveBeenCalledOnceWith('new-task-id');
  });

  it('does nothing when the dialog is cancelled', () => {
    mockDialogResult(undefined);

    service.toggleStartNewTask();

    expect(taskService.add).not.toHaveBeenCalled();
    expect(taskService.setCurrentId).not.toHaveBeenCalled();
  });

  it('does not open the dialog when time tracking is disabled', () => {
    isTimeTrackingEnabled.set(false);

    service.toggleStartNewTask();

    expect(matDialog.open).not.toHaveBeenCalled();
    expect(taskService.add).not.toHaveBeenCalled();
  });

  it('does not open a second dialog while one is open', () => {
    const afterClosed$ = new Subject<string | undefined>();
    matDialog.open.and.returnValue({ afterClosed: () => afterClosed$ } as any);

    service.toggleStartNewTask();
    service.toggleStartNewTask();
    expect(matDialog.open).toHaveBeenCalledTimes(1);

    afterClosed$.next(undefined);
    afterClosed$.complete();
    service.toggleStartNewTask();
    expect(matDialog.open).toHaveBeenCalledTimes(2);
  });

  describe('toggleStartFromHeader', () => {
    it('stops the running task', () => {
      currentTaskId.set('running-task');

      service.toggleStartFromHeader();

      expect(taskService.toggleStartTask).toHaveBeenCalledTimes(1);
      expect(taskService.add).not.toHaveBeenCalled();
    });

    it('tracks the system task without a title and asks for the focus', () => {
      const focusRequest = service.focusTitleInputRequest();

      service.toggleStartFromHeader();

      expect(matDialog.open).not.toHaveBeenCalled();
      expect(taskService.add).not.toHaveBeenCalled();
      expect(systemTaskService.ensureExists).toHaveBeenCalled();
      expect(taskService.setCurrentId).toHaveBeenCalledOnceWith(SYSTEM_TASK_ID);
      expect(service.focusTitleInputRequest()).toBe(focusRequest + 1);
    });

    it('tracks the system task when the draft is only whitespace', () => {
      service.draftTitle.set('   ');

      service.toggleStartFromHeader();

      expect(taskService.add).not.toHaveBeenCalled();
      expect(taskService.setCurrentId).toHaveBeenCalledOnceWith(SYSTEM_TASK_ID);
    });

    it('uses and clears the draft title', () => {
      service.draftTitle.set(' Write report #work ');

      service.toggleStartFromHeader();

      expect(taskService.add).toHaveBeenCalledOnceWith('Write report #work');
      expect(service.draftTitle()).toBe('');
    });

    it('does nothing when time tracking is disabled', () => {
      isTimeTrackingEnabled.set(false);

      service.toggleStartFromHeader();

      expect(taskService.add).not.toHaveBeenCalled();
    });
  });

  describe('assignRunningEntryToNewTask', () => {
    beforeEach(() => {
      currentTaskId.set(SYSTEM_TASK_ID);
      recorder.openSession.set({ taskId: SYSTEM_TASK_ID, start: 1000, lastSeen: 2000 });
    });

    it('creates the task and hands the running entry and its time over', async () => {
      await service.assignRunningEntryToNewTask(' Write report ');

      expect(taskService.add).toHaveBeenCalledOnceWith('Write report');
      expect(recorder.reassignOpenSession).toHaveBeenCalledOnceWith('new-task-id');
      expect(taskService.setCurrentId).toHaveBeenCalledOnceWith('new-task-id');
      expect(timeEntryService.moveTrackedTime).toHaveBeenCalledOnceWith(
        SYSTEM_TASK_ID,
        'new-task-id',
        1000,
        jasmine.any(Number),
      );
    });

    it('does nothing for an empty title', async () => {
      await service.assignRunningEntryToNewTask('  ');

      expect(taskService.add).not.toHaveBeenCalled();
      expect(timeEntryService.moveTrackedTime).not.toHaveBeenCalled();
    });

    it('does nothing when another task is tracked', async () => {
      currentTaskId.set('other-task');

      await service.assignRunningEntryToNewTask('Write report');

      expect(taskService.add).not.toHaveBeenCalled();
    });
  });

  describe('selectExistingTask', () => {
    it('starts the picked task when nothing is tracked', async () => {
      service.draftTitle.set('Writ');

      await service.selectExistingTask('existing');

      expect(taskService.setCurrentId).toHaveBeenCalledOnceWith('existing');
      expect(taskService.add).not.toHaveBeenCalled();
      expect(service.draftTitle()).toBe('');
    });

    it('hands the running entry and its time over to the picked task', async () => {
      currentTaskId.set('running-task');
      recorder.openSession.set({ taskId: 'running-task', start: 1000, lastSeen: 2000 });

      await service.selectExistingTask('existing');

      expect(recorder.reassignOpenSession).toHaveBeenCalledOnceWith('existing');
      expect(taskService.setCurrentId).toHaveBeenCalledOnceWith('existing');
      expect(timeEntryService.moveTrackedTime).toHaveBeenCalledOnceWith(
        'running-task',
        'existing',
        1000,
        jasmine.any(Number),
      );
    });

    it('does nothing when the tracked task is picked', async () => {
      currentTaskId.set('existing');

      await service.selectExistingTask('existing');

      expect(taskService.setCurrentId).not.toHaveBeenCalled();
      expect(timeEntryService.moveTrackedTime).not.toHaveBeenCalled();
    });

    it('does not start when time tracking is disabled', async () => {
      isTimeTrackingEnabled.set(false);

      await service.selectExistingTask('existing');

      expect(taskService.setCurrentId).not.toHaveBeenCalled();
    });
  });
});
