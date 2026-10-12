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
import { TIME_ENTRY_FIELDS } from './time-entry-fields.const';
import { buildTimeEntryExportRows } from './time-entry-export';
import { createXlsx, XlsxColumn } from './xlsx-writer';
import { selectAllProjects } from '../project/store/project.selectors';
import { TranslateService } from '@ngx-translate/core';
import { TagService } from '../tag/tag.service';
import { selectAllTagsWithoutMyDay } from '../tag/store/tag.reducer';
import { T } from '../../t.const';
import {
  applyEntryToTimeSpentOnDay,
  isEntryOnDay,
  normalizeFieldValues,
  sortTimeEntries,
  splitDurationByDay,
} from './time-entry.util';

/** Optional content of a time entry besides its range. */
export type TimeEntryData = Pick<TimeEntry, 'fields' | 'note' | 'tagIds'>;

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
  private readonly _translateService = inject(TranslateService);
  private readonly _tagService = inject(TagService);
  private readonly _allTags = this._store.selectSignal(selectAllTagsWithoutMyDay);

  /**
   * Stores an entry recorded by live tracking. Its time was already counted
   * into timeSpentOnDay by the tracking ticks, so only the entry is added.
   */
  async addTrackedEntry(
    taskId: string,
    start: number,
    end: number,
    data: TimeEntryData = {},
  ): Promise<void> {
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
        this._createEntry(start, end, data),
      ]),
    });
  }

  async addEntry(
    taskId: string,
    start: number,
    end: number,
    data: TimeEntryData = {},
  ): Promise<void> {
    this._assertValidRange(start, end);
    const task = await this._getTaskOrThrow(taskId);
    const entry = this._createEntry(start, end, data);
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
      const { fields, note, tagIds } = this._getEntryOrThrow(
        await this._getTaskOrThrow(taskId),
        entryId,
      );
      await this.deleteEntry(taskId, entryId);
      await this.addEntry(newTaskId, start, end, { fields, note, tagIds });
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

  /**
   * Moves tracked time of the range [start, end) from one task to another,
   * e.g. when a running entry is handed over to another task.
   */
  async moveTrackedTime(
    fromTaskId: string,
    toTaskId: string,
    start: number,
    end: number,
  ): Promise<void> {
    if (!(end > start)) {
      return;
    }
    const diffMs = this._dateService.getStartOfNextDayDiffMs();
    const range = { start, end };
    this._taskTimeSync.flushOne(fromTaskId);
    this._taskTimeSync.flushOne(toTaskId);
    const from = await this._getTaskOrThrow(fromTaskId);
    await this._taskService.updateEverywhere(fromTaskId, {
      timeSpentOnDay: applyEntryToTimeSpentOnDay(from.timeSpentOnDay, range, -1, diffMs),
    });
    const to = await this._getTaskOrThrow(toTaskId);
    await this._taskService.updateEverywhere(toTaskId, {
      timeSpentOnDay: applyEntryToTimeSpentOnDay(to.timeSpentOnDay, range, 1, diffMs),
    });
  }

  /** Sets custom field values; an empty value removes the field from the entry. */
  async updateEntryFields(
    taskId: string,
    entryId: string,
    changes: Record<string, string>,
  ): Promise<void> {
    const task = await this._getTaskOrThrow(taskId);
    const oldEntry = this._getEntryOrThrow(task, entryId);
    const fields = normalizeFieldValues({ ...oldEntry.fields, ...changes });
    const newEntry: TimeEntry = { ...oldEntry };
    delete newEntry.fields;
    if (fields) {
      newEntry.fields = fields;
    }
    await this._taskService.updateEverywhere(taskId, {
      timeEntries: (task.timeEntries || []).map((e) => (e.id === entryId ? newEntry : e)),
    });
  }

  /** The entry and its live or archived task, if both still exist. */
  async getTaskWithEntry(
    taskId: string,
    entryId: string,
  ): Promise<{ task: Task; entry: TimeEntry } | undefined> {
    const task = await this._getTask(taskId);
    const entry = task?.timeEntries?.find((e) => e.id === entryId);
    return task && entry ? { task, entry } : undefined;
  }

  /** Sets the tags of an entry; no tags removes the property. */
  async updateEntryTags(
    taskId: string,
    entryId: string,
    tagIds: string[],
  ): Promise<void> {
    const task = await this._getTaskOrThrow(taskId);
    const oldEntry = this._getEntryOrThrow(task, entryId);
    const newEntry: TimeEntry = { ...oldEntry };
    delete newEntry.tagIds;
    if (tagIds.length) {
      newEntry.tagIds = tagIds;
    }
    await this._taskService.updateEverywhere(taskId, {
      timeEntries: (task.timeEntries || []).map((e) => (e.id === entryId ? newEntry : e)),
    });
  }

  /**
   * Id of the tag with the given title (case-insensitive); creates the tag,
   * with a random color, if there is none.
   */
  getOrCreateTagId(title: string): string {
    const trimmed = title.trim();
    const existing = this._allTags().find(
      (tag) => tag.title.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    return existing ? existing.id : this._tagService.addTag({ title: trimmed });
  }

  /** Sets the note of an entry; an empty note removes it. */
  async updateEntryNote(taskId: string, entryId: string, note: string): Promise<void> {
    const task = await this._getTaskOrThrow(taskId);
    const oldEntry = this._getEntryOrThrow(task, entryId);
    const newEntry: TimeEntry = { ...oldEntry };
    delete newEntry.note;
    if (note.trim()) {
      newEntry.note = note;
    }
    await this._taskService.updateEverywhere(taskId, {
      timeEntries: (task.timeEntries || []).map((e) => (e.id === entryId ? newEntry : e)),
    });
  }

  /**
   * Values already used per suggestable field (live and archived tasks), most
   * recently used first.
   */
  async getUsedFieldValues(): Promise<Record<string, string[]>> {
    const fieldIds = TIME_ENTRY_FIELDS.filter((f) => f.isSuggestUsedValues).map(
      (f) => f.id,
    );
    const lastUsed: Record<string, Map<string, number>> = {};
    for (const id of fieldIds) {
      lastUsed[id] = new Map();
    }
    for (const task of await this._getAllTasks()) {
      for (const entry of task.timeEntries || []) {
        for (const id of fieldIds) {
          const value = entry.fields?.[id];
          if (value && (lastUsed[id].get(value) ?? -1) < entry.end) {
            lastUsed[id].set(value, entry.end);
          }
        }
      }
    }
    const result: Record<string, string[]> = {};
    for (const id of fieldIds) {
      result[id] = [...lastUsed[id].entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value]) => value);
    }
    return result;
  }

  /** XLSX with the entries (and time without entries) of [fromDay, toDay]. */
  async createXlsxExport(fromDay: string, toDay: string): Promise<Uint8Array> {
    const projects = await firstValueFrom(this._store.select(selectAllProjects));
    const projectTitles = Object.fromEntries(projects.map((p) => [p.id, p.title]));
    const tagTitles = Object.fromEntries(
      this._allTags().map((tag) => [tag.id, tag.title]),
    );
    const rows = buildTimeEntryExportRows(
      await this._getAllTasks(),
      projectTitles,
      tagTitles,
      fromDay,
      toDay,
      this._dateService.getStartOfNextDayDiffMs(),
    );
    const t = (key: string): string => this._translateService.instant(key);
    const columns: XlsxColumn[] = [
      { header: t(T.F.TIME_ENTRIES.DATE), width: 12 },
      { header: t(T.F.TIME_ENTRIES.START), width: 8 },
      { header: t(T.F.TIME_ENTRIES.END), width: 8 },
      { header: t(T.F.TIME_ENTRIES.DURATION), width: 10 },
      { header: t(T.F.TIME_ENTRIES.DURATION_HOURS), width: 16 },
      { header: t(T.F.TIME_ENTRIES.TASK), width: 40 },
      { header: t(T.F.TIME_ENTRIES.PROJECT), width: 20 },
      ...TIME_ENTRY_FIELDS.map((f) => ({ header: t(f.label), width: 20 })),
      { header: t(T.F.TIME_ENTRIES.TAGS), width: 20 },
      { header: t(T.F.TIME_ENTRIES.NOTE), width: 60 },
    ];
    return createXlsx(t(T.F.TIME_ENTRIES.TITLE), columns, rows);
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
    const { liveTasks, archivedTasks } = await this._getLiveAndArchivedTasks();

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

  private async _getLiveAndArchivedTasks(): Promise<{
    liveTasks: Task[];
    archivedTasks: Task[];
  }> {
    const liveTasks = await firstValueFrom(this._store.select(selectAllTasks));
    const archive = await this._taskArchiveService.load();
    const liveIds = new Set(liveTasks.map((t) => t.id));
    const archivedTasks = archive.ids
      .map((id) => archive.entities[id])
      .filter((t): t is Task => !!t && !liveIds.has(t.id));
    return { liveTasks, archivedTasks };
  }

  private async _getAllTasks(): Promise<Task[]> {
    const { liveTasks, archivedTasks } = await this._getLiveAndArchivedTasks();
    return [...liveTasks, ...archivedTasks];
  }

  private _createEntry(start: number, end: number, data: TimeEntryData): TimeEntry {
    const entry: TimeEntry = { id: nanoid(), start, end };
    const normalized = normalizeFieldValues(data.fields);
    if (normalized) {
      entry.fields = normalized;
    }
    if (data.note?.trim()) {
      entry.note = data.note;
    }
    if (data.tagIds?.length) {
      entry.tagIds = data.tagIds;
    }
    return entry;
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
