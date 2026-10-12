import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { selectCurrentTask } from '../../../features/tasks/store/task.selectors';
import { T } from '../../../t.const';
import { TaskService } from '../../../features/tasks/task.service';
import { StartNewTaskService } from '../../../features/tasks/start-new-task.service';
import { SYSTEM_TASK_ID } from '../../../features/time-entries/system-task.const';

/**
 * Toggl-style title input next to the play button. While nothing is tracked it
 * holds the title of the next task (Enter starts it); while a task is tracked
 * it shows that task's title, and Enter or leaving the input renames it. Short
 * syntax (#tag, +project, ...) is applied as for any task title. While the
 * "Unassigned" system task is tracked the input is empty, and a title moves the
 * running entry to a new task with that title.
 *
 * Sits in the header's `.pill-slot` like the tracked-task pill it replaces:
 * out of flow, so it can never move a button, and hidden when the slot has no
 * room for it.
 */
@Component({
  selector: 'timer-title-input',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <input
      #input
      class="timer-title-input"
      [class.is-tracking]="!!currentTask()"
      type="text"
      [value]="displayValue()"
      (input)="onInput($any($event.target).value)"
      (keydown.enter)="onEnter()"
      (keydown.escape)="onEscape()"
      (blur)="commitTitle()"
      [placeholder]="T.MH.NEW_TASK_TITLE | translate"
      [attr.aria-label]="T.MH.NEW_TASK_TITLE | translate"
    />
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .timer-title-input {
        /* Out of flow inside .pill-slot, against the play button, like the
           tracked-task pill this replaces (see main-header.component.html). */
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        inset-inline-end: 0;
        width: min(100%, 520px);
        box-sizing: border-box;
        min-height: 32px;
        padding: var(--s-half) var(--s);
        border: 1.5px solid var(--divider-color);
        border-radius: 10px;
        background: var(--bg-lighter);
        color: inherit;
        font: inherit;
        font-size: var(--font-size-md);

        &.is-tracking {
          border-color: var(--c-accent);
        }

        @container header-pill-slot (max-width: 120px) {
          visibility: hidden;
        }

        /* Below XS the bottom nav owns the actions (same as the pill was). */
        @media (max-width: 599px) {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimerTitleInputComponent {
  private readonly _taskService = inject(TaskService);
  private readonly _startNewTaskService = inject(StartNewTaskService);

  readonly T = T;
  private readonly _store = inject(Store);
  readonly currentTask = this._store.selectSignal(selectCurrentTask);
  private readonly _input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** The not yet saved title of the tracked task while it is being edited. */
  private readonly _editValue = signal<string | null>(null);

  readonly displayValue = computed(() => {
    const task = this.currentTask();
    if (!task) {
      return this._startNewTaskService.draftTitle();
    }
    // the system task's title is not shown: a typed title creates a real task
    return this._editValue() ?? (task.id === SYSTEM_TASK_ID ? '' : task.title);
  });

  constructor() {
    // the play button asks for the focus when it starts a new task
    let lastRequest = this._startNewTaskService.focusTitleInputRequest();
    effect(() => {
      const request = this._startNewTaskService.focusTitleInputRequest();
      if (request !== lastRequest) {
        lastRequest = request;
        untracked(() => this._input().nativeElement.focus());
      }
    });

    // a different task starts or tracking stops: drop an unsaved edit. Keyed on
    // the id, as the task object itself changes with every tracking tick.
    effect(() => {
      this._taskService.currentTaskId();
      untracked(() => this._editValue.set(null));
    });
  }

  onInput(value: string): void {
    if (this.currentTask()) {
      this._editValue.set(value);
    } else {
      this._startNewTaskService.draftTitle.set(value);
    }
  }

  onEnter(): void {
    if (this.currentTask()) {
      this.commitTitle();
    } else {
      this._startNewTaskService.toggleStartFromHeader();
    }
  }

  onEscape(): void {
    this._editValue.set(null);
    // the bound value is unchanged while editing, so reset the field itself
    this._input().nativeElement.value = this.displayValue();
    this._input().nativeElement.blur();
  }

  commitTitle(): void {
    const task = this.currentTask();
    const title = this._editValue();
    this._editValue.set(null);
    if (!task || title === null) {
      return;
    }
    if (task.id === SYSTEM_TASK_ID) {
      // never renamed: the running entry moves to a new task instead
      void this._startNewTaskService.assignRunningEntryToNewTask(title);
    } else if (title.trim() !== task.title) {
      this._taskService.update(task.id, { title: title.trim() });
    }
  }
}
