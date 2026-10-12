import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { InlineMarkdownComponent } from '../../../ui/inline-markdown/inline-markdown.component';
import { TimeEntryPanelService } from '../time-entry-panel.service';
import { TimeEntryService } from '../time-entry.service';
import { TimeEntryRecorderService } from '../time-entry-recorder.service';
import { Log } from '../../../core/log';

/** Right panel content for a time entry: its note, edited like task notes. */
@Component({
  selector: 'time-entry-panel',
  standalone: true,
  imports: [MatIconButton, MatIcon, MatTooltip, TranslatePipe, InlineMarkdownComponent],
  template: `
    @if (isReady()) {
      <div class="header">
        <h2>{{ T.F.TIME_ENTRIES.NOTE | translate }}</h2>
        <button
          mat-icon-button
          (click)="close()"
          [matTooltip]="T.G.CLOSE | translate"
          [attr.aria-label]="T.G.CLOSE | translate"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <inline-markdown
        [model]="note()"
        [isShowControls]="true"
        [isShowChecklistToggle]="true"
        [taskId]="taskId()"
        [placeholderTxt]="T.F.TIME_ENTRIES.NOTE_PLACEHOLDER | translate"
        (changed)="save($event)"
      ></inline-markdown>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: var(--s2);
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--s);

        h2 {
          margin: 0;
          font-size: var(--font-size-lg);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeEntryPanelComponent {
  private readonly _panelService = inject(TimeEntryPanelService);
  private readonly _timeEntryService = inject(TimeEntryService);
  private readonly _recorder = inject(TimeEntryRecorderService);

  readonly T = T;
  readonly note = signal('');
  readonly taskId = signal<string | undefined>(undefined);
  readonly isReady = signal(false);

  constructor() {
    // load the note of the entry the panel was opened for
    effect(() => {
      const target = this._panelService.target();
      untracked(() => void this._load(target));
    });

    // the running entry got stored or switched: its panel has nothing to show
    effect(() => {
      const target = this._panelService.target();
      const session = this._recorder.openSession();
      if (target?.isRunning && !session) {
        untracked(() => this._panelService.close());
      }
    });
  }

  async save(note: string): Promise<void> {
    const target = this._panelService.target();
    if (!target) {
      return;
    }
    this.note.set(note);
    if (target.isRunning) {
      this._recorder.setOpenSessionNote(note);
      return;
    }
    try {
      await this._timeEntryService.updateEntryNote(target.taskId, target.entryId, note);
      this._panelService.noteSavedCount.update((n) => n + 1);
    } catch (e) {
      Log.err('Saving the time entry note failed', e);
    }
  }

  close(): void {
    this._panelService.close();
  }

  private async _load(
    target: ReturnType<TimeEntryPanelService['target']>,
  ): Promise<void> {
    this.isReady.set(false);
    if (!target) {
      return;
    }
    if (target.isRunning) {
      const session = this._recorder.openSession();
      this.note.set(session?.note || '');
      this.taskId.set(session?.taskId);
    } else {
      const entry = await this._timeEntryService.getEntry(target.taskId, target.entryId);
      // a different entry was opened meanwhile
      if (this._panelService.target() !== target) {
        return;
      }
      this.note.set(entry?.note || '');
      this.taskId.set(target.taskId);
    }
    this.isReady.set(true);
  }
}
