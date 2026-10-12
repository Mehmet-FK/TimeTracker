import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DEFAULT_TASK, Task } from '../../../features/tasks/task.model';
import { TaskService } from '../../../features/tasks/task.service';
import { StartNewTaskService } from '../../../features/tasks/start-new-task.service';
import { selectCurrentTask } from '../../../features/tasks/store/task.selectors';
import { TimerTitleInputComponent } from './timer-title-input.component';
import {
  SYSTEM_TASK_ID,
  SYSTEM_TASK_TITLE,
} from '../../../features/time-entries/system-task.const';

describe('TimerTitleInputComponent', () => {
  let store: MockStore;
  let currentTaskId: ReturnType<typeof signal<string | null>>;
  let taskService: { currentTaskId: typeof currentTaskId; update: jasmine.Spy };
  let startNewTaskService: {
    draftTitle: ReturnType<typeof signal<string>>;
    focusTitleInputRequest: ReturnType<typeof signal<number>>;
    toggleStartFromHeader: jasmine.Spy;
    assignRunningEntryToNewTask: jasmine.Spy;
  };
  let input: HTMLInputElement;
  let detectChanges: () => void;

  const task: Task = { ...DEFAULT_TASK, id: 't1', title: 'Running task', projectId: '' };

  const setCurrentTask = (t: Task | null): void => {
    store.overrideSelector(selectCurrentTask, t);
    store.refreshState();
    currentTaskId.set(t?.id ?? null);
    detectChanges();
  };

  const type = (value: string): void => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const press = (key: string): void => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key }));
    detectChanges();
  };

  beforeEach(() => {
    currentTaskId = signal<string | null>(null);
    taskService = { currentTaskId, update: jasmine.createSpy('update') };
    startNewTaskService = {
      draftTitle: signal(''),
      focusTitleInputRequest: signal(0),
      toggleStartFromHeader: jasmine.createSpy('toggleStartFromHeader'),
      assignRunningEntryToNewTask: jasmine.createSpy('assignRunningEntryToNewTask'),
    };

    TestBed.configureTestingModule({
      imports: [TimerTitleInputComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore({ selectors: [{ selector: selectCurrentTask, value: null }] }),
        { provide: TaskService, useValue: taskService },
        { provide: StartNewTaskService, useValue: startNewTaskService },
      ],
    });
    store = TestBed.inject(MockStore);
    const fixture = TestBed.createComponent(TimerTitleInputComponent);
    detectChanges = () => fixture.detectChanges();
    detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  describe('while nothing is tracked', () => {
    it('keeps the typed text as draft and starts on Enter', () => {
      type('New task #work');
      expect(startNewTaskService.draftTitle()).toBe('New task #work');

      press('Enter');
      expect(startNewTaskService.toggleStartFromHeader).toHaveBeenCalledTimes(1);
    });
  });

  describe('while a task is tracked', () => {
    beforeEach(() => setCurrentTask(task));

    it('shows the title of the tracked task', () => {
      expect(input.value).toBe('Running task');
    });

    it('renames the task on Enter', () => {
      type(' Renamed #work ');
      press('Enter');

      expect(taskService.update).toHaveBeenCalledOnceWith('t1', {
        title: 'Renamed #work',
      });
      expect(startNewTaskService.toggleStartFromHeader).not.toHaveBeenCalled();
    });

    it('renames the task when leaving the input', () => {
      type('Renamed');
      input.dispatchEvent(new Event('blur'));

      expect(taskService.update).toHaveBeenCalledOnceWith('t1', { title: 'Renamed' });
    });

    it('does not update an unchanged title', () => {
      type('Running task');
      press('Enter');

      expect(taskService.update).not.toHaveBeenCalled();
    });

    it('reverts the edit on Escape', () => {
      type('Renamed');
      press('Escape');

      expect(input.value).toBe('Running task');
      expect(taskService.update).not.toHaveBeenCalled();
    });
  });

  describe('while the system task is tracked', () => {
    beforeEach(() =>
      setCurrentTask({ ...task, id: SYSTEM_TASK_ID, title: SYSTEM_TASK_TITLE }),
    );

    it('is empty instead of showing the system task title', () => {
      expect(input.value).toBe('');
    });

    it('moves the running entry to a new task instead of renaming', () => {
      type('Write report');
      press('Enter');

      expect(startNewTaskService.assignRunningEntryToNewTask).toHaveBeenCalledOnceWith(
        'Write report',
      );
      expect(taskService.update).not.toHaveBeenCalled();
    });
  });

  it('takes the focus when asked to', () => {
    document.body.appendChild(input);
    startNewTaskService.focusTitleInputRequest.set(1);
    detectChanges();

    expect(document.activeElement).toBe(input);
    input.remove();
  });
});
