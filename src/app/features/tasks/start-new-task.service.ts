import { inject, Injectable } from '@angular/core';
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
        this.startNewTask(title);
      });
  }

  /** Creates a task in the active work context and starts tracking it. */
  startNewTask(title: string): string {
    const trimmedTitle =
      title.trim() || this._translateService.instant(T.MH.NEW_TASK_NO_DESCRIPTION);
    const id = this._taskService.add(trimmedTitle);
    this._taskService.setCurrentId(id);
    return id;
  }
}
