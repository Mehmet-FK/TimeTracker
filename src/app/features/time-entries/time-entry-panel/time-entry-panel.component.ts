import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { InlineMarkdownComponent } from '../../../ui/inline-markdown/inline-markdown.component';
import { MsToStringPipe } from '../../../ui/duration/ms-to-string.pipe';
import { TagEditComponent } from '../../tag/tag-edit/tag-edit.component';
import { selectTaskEntities } from '../../tasks/store/task.selectors';
import { TimeEntry } from '../../tasks/task.model';
import { SnackService } from '../../../core/snack/snack.service';
import { TimeEntryPanelService } from '../time-entry-panel.service';
import { TimeEntryService } from '../time-entry.service';
import { TimeEntryRecorderService } from '../time-entry-recorder.service';
import { TIME_ENTRY_FIELDS } from '../time-entry-fields.const';
import {
  getCalendarDayStr,
  getRangeWithDate,
  getRangeWithEndTime,
  getRangeWithStartTime,
  toTimeInputValue,
} from '../time-entry.util';
import { Log } from '../../../core/log';

/** What the panel shows: a stored entry, or the running one (no end yet). */
interface PanelEntry {
  taskTitle: string;
  start: number;
  end: number | null;
  fields: Record<string, string>;
  tagIds: string[];
  note: string;
}

const REQUESTED_BY = 'requestedBy';
const TICKET_NR = 'ticketNr';

/**
 * Right panel content for a time entry: its fields, tags and note. The task is
 * only shown; date and times can not be changed while the entry is running.
 */
@Component({
  selector: 'time-entry-panel',
  standalone: true,
  imports: [
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatInput,
    TranslatePipe,
    InlineMarkdownComponent,
    MsToStringPipe,
    TagEditComponent,
  ],
  templateUrl: './time-entry-panel.component.html',
  styleUrls: ['./time-entry-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeEntryPanelComponent {
  private readonly _store = inject(Store);
  private readonly _panelService = inject(TimeEntryPanelService);
  private readonly _timeEntryService = inject(TimeEntryService);
  private readonly _recorder = inject(TimeEntryRecorderService);
  private readonly _snackService = inject(SnackService);

  readonly T = T;
  readonly REQUESTED_BY = REQUESTED_BY;
  readonly TICKET_NR = TICKET_NR;
  readonly fieldLabels = Object.fromEntries(
    TIME_ENTRY_FIELDS.map((f) => [f.id, f.label]),
  );
  readonly toTimeInputValue = toTimeInputValue;
  readonly getCalendarDayStr = getCalendarDayStr;

  readonly entry = signal<PanelEntry | null>(null);
  readonly taskId = signal<string | undefined>(undefined);
  readonly isRunning = computed(() => !!this._panelService.target()?.isRunning);

  private readonly _taskEntities = this._store.selectSignal(selectTaskEntities);

  private readonly _shownTaskEntries = computed(() => {
    const target = this._panelService.target();
    return target && !target.isRunning
      ? this._taskEntities()[target.taskId]?.timeEntries
      : undefined;
  });

  readonly duration = computed(() => {
    const entry = this.entry();
    if (!entry) {
      return 0;
    }
    const session = this._recorder.openSession();
    const end = entry.end ?? session?.lastSeen ?? entry.start;
    return end - entry.start;
  });

  constructor() {
    // (re)load when another entry is opened or the shown task's entries change
    effect(() => {
      this._panelService.target();
      this._shownTaskEntries();
      untracked(() => void this._load());
    });

    // the running entry: follow the session (fields, tags, note)
    effect(() => {
      const session = this._recorder.openSession();
      if (this.isRunning()) {
        untracked(() => {
          if (!session) {
            // stored or switched: the panel has nothing left to show
            this._panelService.close();
          } else {
            void this._load();
          }
        });
      }
    });
  }

  close(): void {
    this._panelService.close();
  }

  // FIELDS
  // ------
  async onFieldChange(fieldId: string, value: string): Promise<void> {
    const target = this._panelService.target();
    if (target?.isRunning) {
      this._recorder.setOpenSessionFields({ [fieldId]: value });
    } else if (target) {
      await this._save(() =>
        this._timeEntryService.updateEntryFields(target.taskId, target.entryId, {
          [fieldId]: value,
        }),
      );
    }
  }

  async onDateChange(day: string): Promise<void> {
    await this._updateRange((entry) => getRangeWithDate(entry, day));
  }

  async onStartChange(time: string): Promise<void> {
    await this._updateRange((entry) => getRangeWithStartTime(entry, time));
  }

  async onEndChange(time: string): Promise<void> {
    await this._updateRange((entry) => getRangeWithEndTime(entry, time));
  }

  // TAGS
  // ----
  // tag-edit finds an existing tag by title or creates a new one
  async onTagsChange(tagIds: string[]): Promise<void> {
    const target = this._panelService.target();
    if (target?.isRunning) {
      this._recorder.setOpenSessionTagIds(tagIds);
    } else if (target) {
      await this._save(() =>
        this._timeEntryService.updateEntryTags(target.taskId, target.entryId, tagIds),
      );
    }
  }

  // NOTE
  // ----
  async saveNote(note: string): Promise<void> {
    const target = this._panelService.target();
    if (target?.isRunning) {
      this._recorder.setOpenSessionNote(note);
    } else if (target) {
      await this._save(() =>
        this._timeEntryService.updateEntryNote(target.taskId, target.entryId, note),
      );
    }
  }

  private async _updateRange(
    getRange: (entry: Pick<TimeEntry, 'start' | 'end'>) => {
      start: number;
      end: number;
    } | null,
  ): Promise<void> {
    const target = this._panelService.target();
    const entry = this.entry();
    if (!target || target.isRunning || !entry || entry.end === null) {
      return;
    }
    const range = getRange({ start: entry.start, end: entry.end });
    if (!range) {
      this._snackService.open({ type: 'ERROR', msg: T.F.TIME_ENTRIES.ERR_INVALID_RANGE });
      await this._load();
      return;
    }
    if (range.start === entry.start && range.end === entry.end) {
      return;
    }
    await this._save(() =>
      this._timeEntryService.updateEntry(
        target.taskId,
        target.entryId,
        range.start,
        range.end,
      ),
    );
  }

  private async _save(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      this._panelService.entryChangedCount.update((n) => n + 1);
    } catch (e) {
      Log.err('Saving the time entry failed', e);
      this._snackService.open({ type: 'ERROR', msg: T.F.TIME_ENTRIES.ERR_SAVE });
    }
    await this._load();
  }

  private async _load(): Promise<void> {
    const target = this._panelService.target();
    if (!target) {
      this.entry.set(null);
      return;
    }
    if (target.isRunning) {
      const session = this._recorder.openSession();
      this.taskId.set(session?.taskId);
      this.entry.set(
        session
          ? {
              taskTitle: this._taskEntities()[session.taskId]?.title ?? '',
              start: session.start,
              end: null,
              fields: session.fields || {},
              tagIds: session.tagIds || [],
              note: session.note || '',
            }
          : null,
      );
      return;
    }
    const result = await this._timeEntryService.getTaskWithEntry(
      target.taskId,
      target.entryId,
    );
    // a different entry was opened meanwhile
    if (this._panelService.target() !== target) {
      return;
    }
    this.taskId.set(target.taskId);
    this.entry.set(
      result
        ? {
            taskTitle: result.task.title,
            start: result.entry.start,
            end: result.entry.end,
            fields: result.entry.fields || {},
            tagIds: result.entry.tagIds || [],
            note: result.entry.note || '',
          }
        : null,
    );
  }
}
