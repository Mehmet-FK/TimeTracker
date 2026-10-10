import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { StartNewTaskService } from './start-new-task.service';
import { TaskService } from './task.service';
import { T } from '../../t.const';

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

    TestBed.configureTestingModule({
      providers: [
        StartNewTaskService,
        { provide: TaskService, useValue: taskService },
        { provide: MatDialog, useValue: matDialog },
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
});
