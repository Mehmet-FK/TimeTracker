import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { nanoid } from 'nanoid';
import { Task, TimeEntry } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { TaskTimeSyncService } from '../tasks/task-time-sync.service';
import { TaskArchiveService } from '../archive/task-archive.service';
import { DateService } from '../../core/date/date.service';
import { selectAllTasks } from '../tasks/store/task.selectors';
import {
  applyEntryToTimeSpentOnDay,
  isEntryOnDay,
  sortTimeEntries,
  splitDurationByDay,
} from './time-entry.util';

export interface TimeEntryRow {
  task: Task;
  entry: TimeEntry;
  isArchived: boolean;
}

export interface TimeEntriesForDay {
  rows: TimeEntryRow[];
  /** Sum of the entries' durations falling on the day. */
  entriesTotal: number;
  /** Total tracked on the day according to timeSpentOnDay (incl. time without entries). */
  dayTotal: number;
}

/**
 * Adds, edits and deletes time entries. Entries live on their task
 * (`task.timeEntries`); manual changes apply their duration delta to
 * `timeSpentOnDay` in the same update, so totals, worklog and reports stay
 * consistent.
 */
@Injectable({
  providedIn: 'root',
})
export class TimeEntryService {
  private readonly _store = inject(Store);
  private readonly _taskService = inject(TaskService);
  private readonly _taskTimeSync = inject(TaskTimeSyncService);
  private readonly _taskArchiveService = inject(TaskArchiveService);
  private readonly _dateService = inject(DateService);

  /**
   * Stores an entry recorded by live tracking. Its time was already counted
   * into timeSpentOnDay by the tracking ticks, so only the entry is added.
   */
  async addTrackedEntry(taskId: string, start: number, end: number): Promise<void> {
    if (!(end > start)) {
      return;
    }
    const task = await this._getTask(taskId);
    if (!task) {
      return;
    }
    await this._taskService.updateEverywhere(taskId, {
      timeEntries: sortTimeEntries([
        ...(task.timeEntries || []),
        { id: nanoid(), start, end },
      ]),
    });
  }

  async addEntry(taskId: string, start: number, end: number): Promise<void> {
    this._assertValidRange(start, end);
    const task = await this._getTaskOrThrow(taskId);
    const entry: TimeEntry = { id: nanoid(), start, end };
    this._taskTimeSync.flushOne(taskId);
    await this._taskService.updateEverywhere(taskId, {
      timeEntries: sortTimeEntries([...(task.timeEntries || []), entry]),
      timeSpentOnDay: applyEntryToTimeSpentOnDay(
        task.timeSpentOnDay,
        entry,
        1,
        this._dateService.getStartOfNextDayDiffMs(),
      ),
    });
  }

  /**
   * Changes start/end of an entry. When `newTaskId` differs from `taskId`, the
   * entry (and its time) is moved to the other task.
   */
  async updateEntry(
    taskId: string,
    entryId: string,
    start: number,
    end: number,
    newTaskId: string = taskId,
  ): Promise<void> {
    this._assertValidRange(start, end);
    if (newTaskId !== taskId) {
      await this.deleteEntry(taskId, entryId);
      await this.addEntry(newTaskId, start, end);
      return;
    }

    const task = await this._getTaskOrThrow(taskId);
    const oldEntry = this._getEntryOrThrow(task, entryId);
    const diffMs = this._dateService.getStartOfNextDayDiffMs();
    const newEntry: TimeEntry = { ...oldEntry, start, end };
    this._taskTimeSync.flushOne(taskId);
    await this._taskService.updateEverywhere(taskId, {
      timeEntries: sortTimeEntries(
        (task.timeEntries || []).map((e) => (e.id === entryId ? newEntry : e)),
      ),
      timeSpentOnDay: applyEntryToTimeSpentOnDay(
        applyEntryToTimeSpentOnDay(task.timeSpentOnDay, oldEntry, -1, diffMs),
        newEntry,
        1,
        diffMs,
      ),
    });
  }

  async deleteEntry(taskId: string, entryId: string): Promise<void> {
    const task = await this._getTaskOrThrow(taskId);
    const entry = this._getEntryOrThrow(task, entryId);
    this._taskTimeSync.flushOne(taskId);
    await this._taskService.updateEverywhere(taskId, {
      timeEntries: (task.timeEntries || []).filter((e) => e.id !== entryId),
      timeSpentOnDay: applyEntryToTimeSpentOnDay(
        task.timeSpentOnDay,
        entry,
        -1,
        this._dateService.getStartOfNextDayDiffMs(),
      ),
    });
  }

  /** All entries overlapping the given logical day, from live and archived tasks. */
  async getEntriesForDay(day: string): Promise<TimeEntriesForDay> {
    const diffMs = this._dateService.getStartOfNextDayDiffMs();
    const liveTasks = await firstValueFrom(this._store.select(selectAllTasks));
    const archive = await this._taskArchiveService.load();
    const liveIds = new Set(liveTasks.map((t) => t.id));
    const archivedTasks = archive.ids
      .map((id) => archive.entities[id])
      .filter((t): t is Task => !!t && !liveIds.has(t.id));

    const rows: TimeEntryRow[] = [];
    let entriesTotal = 0;
    let dayTotal = 0;
    const collect = (tasks: Task[], isArchived: boolean): void => {
      for (const task of tasks) {
        // parent totals are the sum of their sub tasks
        if (!task.subTaskIds?.length) {
          dayTotal += task.timeSpentOnDay?.[day] || 0;
        }
        for (const entry of task.timeEntries || []) {
          if (isEntryOnDay(entry, day, diffMs)) {
            rows.push({ task, entry, isArchived });
            entriesTotal += splitDurationByDay(entry.start, entry.end, diffMs)[day] || 0;
          }
        }
      }
    };
    collect(liveTasks, false);
    collect(archivedTasks, true);

    rows.sort((a, b) => a.entry.start - b.entry.start);
    return { rows, entriesTotal, dayTotal };
  }

  private async _getTask(taskId: string): Promise<Task | undefined> {
    try {
      return await this._taskService.getByIdFromEverywhere(taskId);
    } catch {
      return undefined;
    }
  }

  private async _getTaskOrThrow(taskId: string): Promise<Task> {
    const task = await this._getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    return task;
  }

  private _getEntryOrThrow(task: Task, entryId: string): TimeEntry {
    const entry = (task.timeEntries || []).find((e) => e.id === entryId);
    if (!entry) {
      throw new Error(`Time entry ${entryId} not found on task ${task.id}`);
    }
    return entry;
  }

  private _assertValidRange(start: number, end: number): void {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error('Time entry end must be after its start');
    }
  }
}
