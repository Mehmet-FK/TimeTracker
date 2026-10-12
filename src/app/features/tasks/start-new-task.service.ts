import { inject, Injectable, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { TaskService } from './task.service';
import { DialogPromptComponent } from '../../ui/dialog-prompt/dialog-prompt.component';
import { T } from '../../t.const';
import { SystemTaskService } from '../time-entries/system-task.service';
import { SYSTEM_TASK_ID } from '../time-entries/system-task.const';
import { TimeEntryRecorderService } from '../time-entries/time-entry-recorder.service';
import { TimeEntryService } from '../time-entries/time-entry.service';

/**
 * Toggl-style start/stop: instead of resuming the selected or the first task
 * of the list, starting the timer creates a fresh task and tracks it.
 */
@Injectable({
  providedIn: 'root',
})
export class StartNewTaskService {
  private readonly _taskService = inject(TaskService);
  private readonly _matDialog = inject(MatDialog);
  private readonly _translateService = inject(TranslateService);
  private readonly _systemTaskService = inject(SystemTaskService);
  private readonly _recorder = inject(TimeEntryRecorderService);
  private readonly _timeEntryService = inject(TimeEntryService);

  private _isPromptOpen = false;

  /** Title typed into the header input before the timer is started. */
  readonly draftTitle = signal('');
  /** Incremented to move the focus to the header title input. */
  readonly focusTitleInputRequest = signal(0);

  /**
   * Header play button: stops the running task, or starts tracking right away
   * and moves the focus to the title input. Without a typed title the time is
   * tracked on the "Unassigned" system task instead of creating a new task.
   */
  toggleStartFromHeader(): void {
    if (this._taskService.currentTaskId() != null) {
      this._taskService.toggleStartTask();
      return;
    }
    if (!this._taskService.isTimeTrackingEnabled()) {
      return;
    }
    if (this.draftTitle().trim()) {
      this.startNewTask(this.draftTitle());
    } else {
      this._systemTaskService.ensureExists();
      this._taskService.setCurrentId(SYSTEM_TASK_ID);
    }
    this.draftTitle.set('');
    this.focusTitleInputRequest.update((n) => n + 1);
  }

  /**
   * While the system task is tracked: creates a task with the given title and
   * hands the running entry, including the time tracked so far, over to it.
   */
  async assignRunningEntryToNewTask(title: string): Promise<void> {
    const session = this._recorder.openSession();
    if (this._taskService.currentTaskId() !== SYSTEM_TASK_ID || !title.trim()) {
      return;
    }
    const id = this._taskService.add(title.trim());
    this._recorder.reassignOpenSession(id);
    this._taskService.setCurrentId(id);
    if (session) {
      await this._timeEntryService.moveTrackedTime(
        SYSTEM_TASK_ID,
        id,
        session.start,
        Date.now(),
      );
    }
  }

  /** Stops the running task, or asks for a title and starts a new task. */
  toggleStartNewTask(): void {
    if (this._taskService.currentTaskId() != null) {
      this._taskService.toggleStartTask();
      return;
    }
    if (!this._taskService.isTimeTrackingEnabled() || this._isPromptOpen) {
      return;
    }

    this._isPromptOpen = true;
    this._matDialog
      .open(DialogPromptComponent, {
        restoreFocus: true,
        data: {
          placeholder: T.MH.NEW_TASK_TITLE,
          saveTxt: T.MH.NEW_TASK_START,
        },
      })
      .afterClosed()
      .subscribe((title: string | undefined) => {
        this._isPromptOpen = false;
        // undefined means the dialog was cancelled
        if (title === undefined) {
          return;
        }
        this.startNewTask(
          title.trim() || this._translateService.instant(T.MH.NEW_TASK_NO_DESCRIPTION),
        );
      });
  }

  /** Creates a task in the active work context and starts tracking it. */
  startNewTask(title: string): string {
    const id = this._taskService.add(title.trim());
    this._taskService.setCurrentId(id);
    return id;
  }
}
