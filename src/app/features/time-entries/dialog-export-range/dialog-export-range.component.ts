import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';

/** Export range as YYYY-MM-DD strings, both days included. */
export interface DialogExportRangeData {
  from: string;
  to: string;
}

export type DialogExportRangeResult = DialogExportRangeData;

/** Asks for the export range; closes with the range on confirm, else undefined. */
@Component({
  selector: 'dialog-export-range',
  templateUrl: './dialog-export-range.component.html',
  styleUrl: './dialog-export-range.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButton, MatFormField, MatLabel, MatInput, TranslatePipe],
})
export class DialogExportRangeComponent {
  private readonly _dialogRef =
    inject<MatDialogRef<DialogExportRangeComponent, DialogExportRangeResult>>(
      MatDialogRef,
    );
  private readonly _data = inject<DialogExportRangeData>(MAT_DIALOG_DATA);

  readonly T = T;
  readonly from = signal(this._data.from);
  readonly to = signal(this._data.to);

  readonly isRangeInvalid = computed(
    () => !this.from() || !this.to() || this.from() > this.to(),
  );

  confirm(): void {
    if (this.isRangeInvalid()) {
      return;
    }
    this._dialogRef.close({ from: this.from(), to: this.to() });
  }
}
