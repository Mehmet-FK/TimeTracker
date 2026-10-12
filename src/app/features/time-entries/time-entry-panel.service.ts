import { inject, Injectable, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { hidePluginPanel } from '../../core-ui/layout/store/layout.actions';
import { TaskService } from '../tasks/task.service';

/** The entry shown in the right panel: a stored entry or the running one. */
export type TimeEntryPanelTarget =
  | { taskId: string; entryId: string; isRunning?: false }
  | { isRunning: true };

/**
 * Opens a time entry's note in the right side panel (like the task detail
 * panel). Holds which entry is shown; the right panel shows it while set.
 */
@Injectable({
  providedIn: 'root',
})
export class TimeEntryPanelService {
  private readonly _store = inject(Store);
  private readonly _layoutService = inject(LayoutService);
  private readonly _taskService = inject(TaskService);

  readonly target = signal<TimeEntryPanelTarget | null>(null);
  /** Incremented when a note of a stored entry was saved from the panel. */
  readonly noteSavedCount = signal(0);

  open(target: TimeEntryPanelTarget): void {
    // one panel at a time
    this._taskService.setSelectedId(null);
    this._layoutService.hideNotes();
    this._layoutService.hideAddTaskPanel();
    this._layoutService.hideTaskViewCustomizerPanel();
    this._layoutService.hideScheduleDayPanel();
    this._store.dispatch(hidePluginPanel());
    this.target.set(target);
  }

  close(): void {
    this.target.set(null);
  }
}
