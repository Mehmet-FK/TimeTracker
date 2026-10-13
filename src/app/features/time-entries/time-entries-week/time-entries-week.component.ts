import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
} from '@angular/cdk/overlay';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { MsToStringPipe } from '../../../ui/duration/ms-to-string.pipe';
import { LocaleDatePipe } from '../../../ui/pipes/locale-date.pipe';
import { ShortTimePipe } from '../../../ui/pipes/short-time.pipe';
import { TagComponent } from '../../tag/tag/tag.component';
import { selectAllTagsWithoutMyDay } from '../../tag/store/tag.reducer';
import { selectAllProjects } from '../../project/store/project.selectors';
import { selectTaskEntities } from '../../tasks/store/task.selectors';
import { Task } from '../../tasks/task.model';
import { DEFAULT_PROJECT_COLOR } from '../../work-context/work-context.const';
import { TimeEntryPanelService, TimeEntryPanelTarget } from '../time-entry-panel.service';
import { TimeEntryRecorderService } from '../time-entry-recorder.service';
import { TimeEntryRow } from '../time-entry.service';
import { combineDayAndTime } from '../time-entry.util';
import { layoutWeek } from '../time-entry-week.util';

/** A stored or the running entry as shown in the week. */
interface WeekEntry {
  key: string;
  target: TimeEntryPanelTarget;
  title: string;
  start: number;
  end: number;
  color: string;
  note?: string;
  tagIds?: string[];
}

const HOUR_HEIGHT_PX = 40;
const DEFAULT_SCROLL_HOUR = 8;
const HOVER_GAP = 4;
/** Blocks shorter than an hour show title and duration in one line. */
const SHORT_BLOCK_PERCENT = (1 / 24) * 100;

/**
 * Monday to Sunday calendar of time entries, positioned by their start and
 * end time. Hovering an entry shows its tags and note, clicking opens it in
 * the time entry panel.
 */
@Component({
  selector: 'time-entries-week',
  standalone: true,
  imports: [
    CdkOverlayOrigin,
    CdkConnectedOverlay,
    TranslatePipe,
    MsToStringPipe,
    LocaleDatePipe,
    ShortTimePipe,
    TagComponent,
  ],
  templateUrl: './time-entries-week.component.html',
  styleUrls: ['./time-entries-week.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeEntriesWeekComponent {
  private readonly _store = inject(Store);
  private readonly _panelService = inject(TimeEntryPanelService);
  private readonly _recorder = inject(TimeEntryRecorderService);

  readonly T = T;
  readonly HOUR_HEIGHT_PX = HOUR_HEIGHT_PX;
  readonly SHORT_BLOCK_PERCENT = SHORT_BLOCK_PERCENT;

  /** Monday of the shown week ('YYYY-MM-DD'). */
  readonly weekStart = input.required<string>();
  /** Stored entries overlapping the week. */
  readonly rows = input.required<TimeEntryRow[]>();

  private readonly _projects = this._store.selectSignal(selectAllProjects);
  private readonly _taskEntities = this._store.selectSignal(selectTaskEntities);
  private readonly _allTags = this._store.selectSignal(selectAllTagsWithoutMyDay);

  private readonly _projectColors = computed(
    () =>
      new Map(
        this._projects().map((p) => [p.id, p.theme?.primary || DEFAULT_PROJECT_COLOR]),
      ),
  );

  private readonly _entries = computed<WeekEntry[]>(() => {
    const colorOf = (task: Task | undefined): string =>
      (task && this._projectColors().get(task.projectId)) || DEFAULT_PROJECT_COLOR;
    const entries: WeekEntry[] = this.rows().map(({ task, entry }) => ({
      key: entry.id,
      target: { taskId: task.id, entryId: entry.id },
      title: task.title,
      start: entry.start,
      end: entry.end,
      color: colorOf(task),
      note: entry.note,
      tagIds: entry.tagIds,
    }));
    const session = this._recorder.openSession();
    if (session) {
      const task = this._taskEntities()[session.taskId];
      entries.push({
        key: 'running',
        target: { isRunning: true },
        title: task?.title ?? '',
        start: session.start,
        end: session.lastSeen,
        color: colorOf(task),
        note: session.note,
        tagIds: session.tagIds,
      });
    }
    return entries;
  });

  readonly days = computed(() => layoutWeek(this.weekStart(), this._entries()));
  readonly hours = computed(() =>
    Array.from({ length: 24 }, (_, h) => combineDayAndTime(this.weekStart(), `${h}:00`)),
  );

  readonly hovered = signal<{ entry: WeekEntry; origin: CdkOverlayOrigin } | null>(null);
  readonly hoveredTags = computed(() => {
    const ids = this.hovered()?.entry.tagIds || [];
    return this._allTags().filter((tag) => ids.includes(tag.id));
  });
  // right of the entry, or left of it when there is no room
  readonly hoverPositions: ConnectedPosition[] = [
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'top',
      offsetX: HOVER_GAP,
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'top',
      offsetX: -HOVER_GAP,
    },
  ];

  private readonly _scrollEl = viewChild.required<ElementRef<HTMLElement>>('scrollEl');
  private _scrolledWeek: string | null = null;

  constructor() {
    // show the week's first entry (or the morning) when a week is opened
    afterRenderEffect(() => {
      const weekStart = this.weekStart();
      if (weekStart === this._scrolledWeek) {
        return;
      }
      this._scrolledWeek = weekStart;
      const firstTops = this.days()
        .flatMap((day) => day.blocks)
        .map((block) => block.top);
      const hour = firstTops.length
        ? Math.floor((Math.min(...firstTops) / 100) * 24)
        : DEFAULT_SCROLL_HOUR;
      this._scrollEl().nativeElement.scrollTop = Math.max(0, hour - 1) * HOUR_HEIGHT_PX;
    });
  }

  open(entry: WeekEntry): void {
    this.hovered.set(null);
    this._panelService.open(entry.target);
  }
}
