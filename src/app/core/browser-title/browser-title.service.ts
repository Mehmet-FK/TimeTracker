import { effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { msToString } from '../../ui/duration/ms-to-string.pipe';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- grandfathered layer-boundary debt
import { TaskService } from '../../features/tasks/task.service';
import { DateService } from '../date/date.service';

@Injectable({
  providedIn: 'root',
})
export class BrowserTitleService {
  private _titleService = inject(Title);
  private _taskService = inject(TaskService);
  private _dateService = inject(DateService);

  private readonly _baseTitle = 'Super Productivity';
  private readonly _currentTask = toSignal(this._taskService.currentTask$, {
    initialValue: null,
  });

  constructor() {
    effect(() => {
      this._titleService.setTitle(this._getTrackingTitle());
    });
  }

  private _getTrackingTitle(): string {
    const task = this._currentTask();
    if (!task) {
      return this._baseTitle;
    }
    // Today's total on the task, not time since tracking started - no start
    // timestamp is persisted.
    const timeToday = task.timeSpentOnDay[this._dateService.todayStr()] ?? 0;
    return `${msToString(timeToday, false, true) || '0m'} - ${task.title}`;
  }
}
