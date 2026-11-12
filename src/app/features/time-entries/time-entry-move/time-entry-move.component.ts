import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import {
  MatAutocomplete,
  MatAutocompleteTrigger,
  MatOption,
} from '@angular/material/autocomplete';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { Log } from '../../../core/log';
import { SnackService } from '../../../core/snack/snack.service';
import { selectAllTasks } from '../../tasks/store/task.selectors';
import { Task } from '../../tasks/task.model';
import { TimeEntryService } from '../time-entry.service';
import { filterLeafTasks } from './task-options.util';

/**
 * How long a blur waits before it closes the search: picking an option (a tap
 * on mobile) blurs the input before the option is selected.
 */
export const MOVE_BLUR_CLOSE_DELAY_MS = 200;

/**
 * The "Move to another task" control of a time entry, shared by the list and
 * the side drawer. Shows the projected content (the task title) and a button;
 * the button turns into a task search, and picking a task moves the entry.
 */
@Component({
  selector: 'time-entry-move',
  standalone: true,
  imports: [
    FormsModule,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    TranslatePipe,
  ],
  templateUrl: './time-entry-move.component.html',
  styleUrls: ['./time-entry-move.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeEntryMoveComponent {
  private readonly _store = inject(Store);
  private readonly _timeEntryService = inject(TimeEntryService);
  private readonly _snackService = inject(SnackService);
  private readonly _injector = inject(Injector);

  readonly T = T;

  /** The task the entry is on now. */
  readonly taskId = input.required<string>();
  readonly entryId = input.required<string>();
  readonly start = input.required<number>();
  readonly end = input.required<number>();
  /** Hides the move button (e.g. for an entry that is still running). */
  readonly isDisabled = input(false);
  /**
   * 'outline' renders the search as an outlined Material field labelled
   * "Task", matching the read-only field of the side panel; 'plain' is the
   * borderless input of the list rows.
   */
  readonly appearance = input<'plain' | 'outline'>('plain');
  /** Emits the new task id once the entry was moved. It has a new id then. */
  readonly moved = output<string>();

  readonly isMoving = signal(false);
  readonly query = signal('');

  private readonly _allTasks = this._store.selectSignal(selectAllTasks);
  readonly options = computed<Task[]>(() =>
    filterLeafTasks(this._allTasks(), this.query()),
  );
  private readonly _input = viewChild<ElementRef<HTMLInputElement>>('moveInput');
  private readonly _autocomplete = viewChild(MatAutocomplete);
  private _blurTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this._blurTimeout));
  }

  startMove(): void {
    this.query.set('');
    this.isMoving.set(true);
    // focus the search once, as soon as it is rendered
    afterNextRender(() => this._input()?.nativeElement.focus(), {
      injector: this._injector,
    });
  }

  cancelMove(): void {
    clearTimeout(this._blurTimeout);
    this.isMoving.set(false);
  }

  onBlur(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const panel = this._autocomplete()?.panel?.nativeElement as HTMLElement | undefined;
    if (next && panel?.contains(next)) {
      // an option is being picked; selectTask closes the search
      return;
    }
    clearTimeout(this._blurTimeout);
    this._blurTimeout = setTimeout(() => {
      const el = this._input()?.nativeElement;
      if (this.isMoving() && (!el || document.activeElement !== el)) {
        this.cancelMove();
      }
    }, MOVE_BLUR_CLOSE_DELAY_MS);
  }

  /** The option panel closed without a pick while the input is not focused. */
  onPanelClosed(): void {
    const el = this._input()?.nativeElement;
    if (this.isMoving() && el && document.activeElement !== el) {
      this.cancelMove();
    }
  }

  async selectTask(newTaskId: string): Promise<void> {
    this.cancelMove();
    if (newTaskId === this.taskId()) {
      return;
    }
    try {
      await this._timeEntryService.updateEntry(
        this.taskId(),
        this.entryId(),
        this.start(),
        this.end(),
        newTaskId,
      );
    } catch (e) {
      Log.err('Moving the time entry failed', e);
      this._snackService.open({ type: 'ERROR', msg: T.F.TIME_ENTRIES.ERR_SAVE });
      return;
    }
    this.moved.emit(newTaskId);
  }
}
