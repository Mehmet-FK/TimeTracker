import { inject, Injectable, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { TaskService } from './task.service';
import { DialogPromptComponent } from '../../ui/dialog-prompt/dialog-prompt.component';
import { T } from '../../t.const';

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

  private _isPromptOpen = false;

  /** Title typed into the header input before the timer is started. */
  readonly draftTitle = signal('');
  /** Incremented to move the focus to the header title input. */
  readonly focusTitleInputRequest = signal(0);

  /**
   * Header play button: stops the running task, or starts a new task right
   * away (titled with the draft, if any) and moves the focus to the title input
   * so the title can be typed while the timer runs.
   */
  toggleStartFromHeader(): void {
    if (this._taskService.currentTaskId() != null) {
      this._taskService.toggleStartTask();
      return;
    }
    if (!this._taskService.isTimeTrackingEnabled()) {
      return;
    }
    this.startNewTask(this.draftTitle());
    this.draftTitle.set('');
    this.focusTitleInputRequest.update((n) => n + 1);
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
