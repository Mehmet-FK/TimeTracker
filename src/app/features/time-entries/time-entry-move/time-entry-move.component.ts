import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
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

  readonly T = T;

  /** The task the entry is on now. */
  readonly taskId = input.required<string>();
  readonly entryId = input.required<string>();
  readonly start = input.required<number>();
  readonly end = input.required<number>();
  /** Hides the move button (e.g. for an entry that is still running). */
  readonly isDisabled = input(false);
  /** Emits the new task id once the entry was moved. It has a new id then. */
  readonly moved = output<string>();

  readonly isMoving = signal(false);
  readonly query = signal('');

  private readonly _allTasks = this._store.selectSignal(selectAllTasks);
  readonly options = computed<Task[]>(() =>
    filterLeafTasks(this._allTasks(), this.query()),
  );
  private readonly _input = viewChild<ElementRef<HTMLInputElement>>('moveInput');

  constructor() {
    // focus the task search when moving starts
    effect(() => this._input()?.nativeElement.focus());
  }

  startMove(): void {
    this.query.set('');
    this.isMoving.set(true);
  }

  cancelMove(): void {
    this.isMoving.set(false);
  }

  async selectTask(newTaskId: string): Promise<void> {
    this.isMoving.set(false);
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
