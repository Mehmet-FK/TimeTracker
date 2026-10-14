import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import {
  MatAutocomplete,
  MatAutocompleteTrigger,
  MatOption,
} from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { T } from '../../t.const';
import {
  selectAllTasks,
  selectTaskEntities,
} from '../../features/tasks/store/task.selectors';
import { Task } from '../../features/tasks/task.model';
import { TaskService } from '../../features/tasks/task.service';
import { DateService } from '../../core/date/date.service';
import { SnackService } from '../../core/snack/snack.service';
import { MsToStringPipe } from '../../ui/duration/ms-to-string.pipe';
import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';
import { TimeEntryPanelService } from '../../features/time-entries/time-entry-panel.service';
import {
  TimeEntriesForDay,
  TimeEntryRow,
  TimeEntryService,
} from '../../features/time-entries/time-entry.service';
import { TimeEntryRecorderService } from '../../features/time-entries/time-entry-recorder.service';
import { TIME_ENTRY_FIELDS } from '../../features/time-entries/time-entry-fields.const';
import {
  combineDayAndTime,
  getCalendarDayStr,
  getInheritedFieldValues,
  getRangeForLogicalDay,
  getRangeWithDate,
  getRangeWithEndTime,
  getRangeWithStartTime,
  shiftByDays,
  splitDurationByDay,
  toTimeInputValue,
} from '../../features/time-entries/time-entry.util';
import { getDbDateStr } from '../../util/get-db-date-str';
import { LS } from '../../core/persistence/storage-keys.const';
import { Log } from '../../core/log';
import { TagComponent } from '../../features/tag/tag/tag.component';
import { selectAllTagsWithoutMyDay } from '../../features/tag/store/tag.reducer';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { TimeEntriesWeekComponent } from '../../features/time-entries/time-entries-week/time-entries-week.component';
import { getWeekStartDay } from '../../features/time-entries/time-entry-week.util';

const MAX_TASK_OPTIONS = 30;
/** Untimed remainders below this are rounding noise from live tracking. */
const MIN_UNTIMED_MS = 60 * 1000;

@Component({
  selector: 'time-entries-page',
  templateUrl: './time-entries-page.component.html',
  styleUrls: ['./time-entries-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatButtonToggle,
    MatButtonToggleGroup,
    TranslatePipe,
    MsToStringPipe,
    TagComponent,
    TimeEntriesWeekComponent,
  ],
})
export class TimeEntriesPageComponent {
  private readonly _store = inject(Store);
  private readonly _taskService = inject(TaskService);
  private readonly _timeEntryService = inject(TimeEntryService);
  private readonly _recorder = inject(TimeEntryRecorderService);
  private readonly _dateService = inject(DateService);
  private readonly _snackService = inject(SnackService);
  private readonly _matDialog = inject(MatDialog);
  private readonly _timeEntryPanelService = inject(TimeEntryPanelService);
  private readonly _dataInitStateService = inject(DataInitStateService);

  readonly T = T;
  readonly toTimeInputValue = toTimeInputValue;
  readonly getCalendarDayStr = getCalendarDayStr;

  readonly day = signal<string>(this._dateService.todayStr());
  // export range, defaults to the current month
  readonly exportFrom = signal<string>(this._dateService.todayStr().slice(0, 8) + '01');
  readonly exportTo = signal<string>(this._dateService.todayStr());
  readonly data = signal<TimeEntriesForDay | null>(null);
  readonly view = signal<'list' | 'week'>(
    localStorage.getItem(LS.TIME_ENTRIES_VIEW) === 'week' ? 'week' : 'list',
  );
  /** Entries of the week containing `day`, while the week is shown. */
  readonly weekData = signal<{ weekStart: string; rows: TimeEntryRow[] } | null>(null);

  // add form
  readonly newTaskQuery = signal('');
  readonly newTaskId = signal<string | null>(null);
  readonly newStart = signal('');
  readonly newEnd = signal('');
  readonly newFields = signal<Record<string, string>>({});
  readonly fieldDefs = TIME_ENTRY_FIELDS;
  readonly usedFieldValues = signal<Record<string, string[]>>({});
  private _selectedTaskTitle: string | null = null;

  private readonly _allTasks = this._store.selectSignal(selectAllTasks);
  private readonly _allTags = this._store.selectSignal(selectAllTagsWithoutMyDay);
  readonly tagById = computed(() => new Map(this._allTags().map((tag) => [tag.id, tag])));
  private readonly _taskEntities = this._store.selectSignal(selectTaskEntities);

  /** Only tasks without sub tasks hold time themselves. */
  private readonly _leafTasks = computed(() =>
    this._allTasks().filter((t) => !t.subTaskIds.length),
  );

  readonly taskOptions = computed<Task[]>(() => this._filterTasks(this.newTaskQuery()));

  // moving an entry to another task
  readonly movingEntryId = signal<string | null>(null);
  readonly moveTaskQuery = signal('');
  readonly moveTaskOptions = computed<Task[]>(() =>
    this._filterTasks(this.moveTaskQuery()),
  );
  private readonly _moveInput = viewChild<ElementRef<HTMLInputElement>>('moveInput');

  readonly runningEntry = computed(() => {
    const session = this._recorder.openSession();
    if (!session) {
      return null;
    }
    const diffMs = this._dateService.getStartOfNextDayDiffMs();
    if (
      !(this.day() in splitDurationByDay(session.start, session.lastSeen + 1, diffMs))
    ) {
      return null;
    }
    return {
      start: session.start,
      duration: session.lastSeen - session.start,
      title: this._taskEntities()[session.taskId]?.title ?? '',
      fields: session.fields,
      note: session.note,
    };
  });

  /** Time tracked on the day that has no entry (legacy data or idle time). */
  readonly untimedTotal = computed(() => {
    const data = this.data();
    if (!data) {
      return 0;
    }
    const running = this.runningEntry();
    const runningOnDay = running
      ? splitDurationByDay(
          running.start,
          running.start + running.duration,
          this._dateService.getStartOfNextDayDiffMs(),
        )[this.day()] || 0
      : 0;
    const untimed = data.dayTotal - data.entriesTotal - runningOnDay;
    return untimed >= MIN_UNTIMED_MS ? untimed : 0;
  });

  private readonly _isDataLoaded = toSignal(
    this._dataInitStateService.isAllDataLoadedInitially$,
    { initialValue: false },
  );
  // changes only when an entry list of a live task changes, not on every tracking tick
  private readonly _liveTimeEntries = computed(
    () => this._allTasks().map((t) => t.timeEntries),
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
  );
  private readonly _sessionKey = computed(() => {
    const session = this._recorder.openSession();
    return session ? `${session.taskId}:${session.start}` : '';
  });
  private _loadCounter = 0;

  constructor() {
    // the note panel belongs to this page
    inject(DestroyRef).onDestroy(() => this._timeEntryPanelService.close());

    // focus the task search when moving an entry starts
    effect(() => this._moveInput()?.nativeElement.focus());

    // reload when the data is ready, the day or view changes, live entries
    // change or a tracked session starts/ends
    effect(() => {
      if (!this._isDataLoaded()) {
        return;
      }
      this.day();
      this.view();
      this._liveTimeEntries();
      this._sessionKey();
      this._timeEntryPanelService.entryChangedCount();
      untracked(() => void this._reload());
    });
  }

  // DAY NAVIGATION
  // --------------
  goToDay(day: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      this.day.set(day);
    }
  }

  setView(view: 'list' | 'week'): void {
    this.view.set(view);
    localStorage.setItem(LS.TIME_ENTRIES_VIEW, view);
  }

  /** Moves by a day in the list and by a week in the week view. */
  shiftPeriod(direction: 1 | -1): void {
    this.shiftDay(this.view() === 'week' ? direction * 7 : direction);
  }

  shiftDay(days: number): void {
    this.day.set(
      getDbDateStr(new Date(shiftByDays(combineDayAndTime(this.day(), '12:00'), days))),
    );
  }

  goToToday(): void {
    this.day.set(this._dateService.todayStr());
  }

  // ADD
  // ---
  onTaskQueryChange(query: string): void {
    this.newTaskQuery.set(query);
    if (query !== this._selectedTaskTitle) {
      this.newTaskId.set(null);
      this._selectedTaskTitle = null;
    }
  }

  selectTask(task: Task): void {
    this._selectedTaskTitle = task.title;
    this.newTaskId.set(task.id);
    // prefill fields the user has not filled yet from the task's latest entry
    const inherited = getInheritedFieldValues(task.timeEntries);
    this.newFields.update((fields) => {
      const result = { ...fields };
      for (const [id, value] of Object.entries(inherited)) {
        if (!result[id]?.trim()) {
          result[id] = value;
        }
      }
      return result;
    });
  }

  setNewFieldValue(fieldId: string, value: string): void {
    this.newFields.update((fields) => ({ ...fields, [fieldId]: value }));
  }

  async addEntry(): Promise<void> {
    const title = this.newTaskQuery().trim();
    if (!this.newTaskId() && !title) {
      this._showError(T.F.TIME_ENTRIES.ERR_NO_TASK);
      return;
    }
    if (!this.newStart() || !this.newEnd()) {
      this._showError(T.F.TIME_ENTRIES.ERR_INVALID_RANGE);
      return;
    }
    const { start, end } = getRangeForLogicalDay(
      this.day(),
      this.newStart(),
      this.newEnd(),
      this._dateService.getStartOfNextDayDiffMs(),
    );
    if (!(end > start)) {
      this._showError(T.F.TIME_ENTRIES.ERR_INVALID_RANGE);
      return;
    }

    const taskId =
      this.newTaskId() ??
      this._leafTasks().find((t) => t.title === title)?.id ??
      this._taskService.add(title);

    const fields = this.newFields();
    await this._run(() =>
      this._timeEntryService.addEntry(taskId, start, end, { fields }),
    );
    this.newTaskQuery.set('');
    this.newTaskId.set(null);
    this._selectedTaskTitle = null;
    this.newStart.set('');
    this.newEnd.set('');
    this.newFields.set({});
  }

  // EDIT
  // ----
  async onStartChange(row: TimeEntryRow, time: string): Promise<void> {
    await this._updateRange(row, getRangeWithStartTime(row.entry, time));
  }

  async onEndChange(row: TimeEntryRow, time: string): Promise<void> {
    await this._updateRange(row, getRangeWithEndTime(row.entry, time));
  }

  async onDateChange(row: TimeEntryRow, day: string): Promise<void> {
    await this._updateRange(row, getRangeWithDate(row.entry, day));
  }

  private async _updateRange(
    row: TimeEntryRow,
    range: { start: number; end: number } | null,
  ): Promise<void> {
    if (!range) {
      this._showError(T.F.TIME_ENTRIES.ERR_INVALID_RANGE);
      await this._reload();
      return;
    }
    if (range.start === row.entry.start && range.end === row.entry.end) {
      return;
    }
    await this._run(() =>
      this._timeEntryService.updateEntry(
        row.task.id,
        row.entry.id,
        range.start,
        range.end,
      ),
    );
  }

  async onFieldChange(row: TimeEntryRow, fieldId: string, value: string): Promise<void> {
    await this._run(() =>
      this._timeEntryService.updateEntryFields(row.task.id, row.entry.id, {
        [fieldId]: value,
      }),
    );
  }

  onRunningFieldChange(fieldId: string, value: string): void {
    this._recorder.setOpenSessionFields({ [fieldId]: value });
  }

  startMove(row: TimeEntryRow): void {
    this.moveTaskQuery.set('');
    this.movingEntryId.set(row.entry.id);
  }

  cancelMove(): void {
    this.movingEntryId.set(null);
  }

  async moveEntry(row: TimeEntryRow, newTaskId: string): Promise<void> {
    this.movingEntryId.set(null);
    if (newTaskId === row.task.id) {
      return;
    }
    // a moved entry gets a new id, so its note panel would point nowhere
    this._closeNotePanelFor(row);
    await this._run(() =>
      this._timeEntryService.updateEntry(
        row.task.id,
        row.entry.id,
        row.entry.start,
        row.entry.end,
        newTaskId,
      ),
    );
  }

  openNote(row: TimeEntryRow): void {
    this._timeEntryPanelService.open({ taskId: row.task.id, entryId: row.entry.id });
  }

  openRunningNote(): void {
    this._timeEntryPanelService.open({ isRunning: true });
  }

  async deleteEntry(row: TimeEntryRow): Promise<void> {
    const isConfirm = await firstValueFrom(
      this._matDialog
        .open(DialogConfirmComponent, {
          restoreFocus: true,
          data: {
            message: T.F.TIME_ENTRIES.DELETE_CONFIRM,
            okTxt: T.F.TIME_ENTRIES.DELETE,
          },
        })
        .afterClosed(),
    );
    if (isConfirm) {
      this._closeNotePanelFor(row);
      await this._run(() =>
        this._timeEntryService.deleteEntry(row.task.id, row.entry.id),
      );
    }
  }

  private _closeNotePanelFor(row: TimeEntryRow): void {
    const target = this._timeEntryPanelService.target();
    if (target && !target.isRunning && target.entryId === row.entry.id) {
      this._timeEntryPanelService.close();
    }
  }

  private async _run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (e) {
      Log.err('Time entry change failed', e);
      this._showError(T.F.TIME_ENTRIES.ERR_SAVE);
    }
    await this._reload();
  }

  private async _reload(): Promise<void> {
    const loadId = ++this._loadCounter;
    if (this.view() === 'week') {
      const weekStart = getWeekStartDay(this.day());
      const rows = await this._timeEntryService.getEntriesBetween(
        combineDayAndTime(weekStart, '00:00'),
        combineDayAndTime(weekStart, '00:00', 7),
      );
      if (loadId === this._loadCounter) {
        this.weekData.set({ weekStart, rows });
      }
      return;
    }
    const [data, usedFieldValues] = await Promise.all([
      this._timeEntryService.getEntriesForDay(this.day()),
      this._timeEntryService.getUsedFieldValues(),
    ]);
    // ignore results of an outdated load (e.g. the day changed meanwhile)
    if (loadId === this._loadCounter) {
      this.data.set(data);
      this.usedFieldValues.set(usedFieldValues);
    }
  }

  // EXPORT
  // ------
  async exportXlsx(): Promise<void> {
    const from = this.exportFrom();
    const to = this.exportTo();
    if (!from || !to || from > to) {
      this._showError(T.F.TIME_ENTRIES.ERR_EXPORT_RANGE);
      return;
    }
    const data = await this._timeEntryService.createXlsxExport(from, to);
    const blob = new Blob([data as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-entries_${from}_${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // OLD RECORDS
  // -----------
  /** Turns time tracked without start and end into entries with estimated times. */
  async convertLegacyTime(): Promise<void> {
    const plans = await this._timeEntryService.planLegacyConversion();
    if (!plans.length) {
      this._snackService.open({ type: 'SUCCESS', msg: T.F.TIME_ENTRIES.CONVERT_NONE });
      return;
    }
    const isConfirm = await firstValueFrom(
      this._matDialog
        .open(DialogConfirmComponent, {
          restoreFocus: true,
          data: {
            message: T.F.TIME_ENTRIES.CONVERT_CONFIRM,
            translateParams: { count: plans.length },
            okTxt: T.F.TIME_ENTRIES.CONVERT,
          },
        })
        .afterClosed(),
    );
    if (!isConfirm) {
      return;
    }
    await this._run(() => this._timeEntryService.applyLegacyConversion(plans));
    this._snackService.open({
      type: 'SUCCESS',
      msg: T.F.TIME_ENTRIES.CONVERT_DONE,
      translateParams: { count: plans.length },
    });
  }

  private _filterTasks(query: string): Task[] {
    const q = query.trim().toLowerCase();
    const tasks = this._leafTasks();
    return (q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : tasks).slice(
      0,
      MAX_TASK_OPTIONS,
    );
  }

  private _showError(msg: string): void {
    this._snackService.open({ type: 'ERROR', msg });
  }
}
