import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { TimeEntryExportTable, TimeEntryService } from '../time-entry.service';
import { XlsxCell } from '../xlsx-writer';

export interface DialogExportPreviewData {
  from: string;
  to: string;
  table: TimeEntryExportTable;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Excel serial day number of 1970-01-01
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Readable text of an export cell, like the cell looks in the XLSX. */
export const formatExportCell = (cell: XlsxCell): string => {
  if (cell === null) {
    return '';
  }
  if (typeof cell === 'string') {
    return cell;
  }
  if (cell.format === 'decimal') {
    return cell.value.toFixed(2);
  }
  if (cell.format === 'duration') {
    const totalMin = Math.round((cell.value * MS_PER_DAY) / 60000);
    return `${Math.floor(totalMin / 60)}:${pad(totalMin % 60)}`;
  }
  // date/time serials hold local time, so read them as UTC fields
  const d = new Date(Math.round((cell.value - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY));
  if (cell.format === 'date') {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** Downloads the bytes as a file. */
export const downloadXlsxFile = (data: Uint8Array, fileName: string): void => {
  const blob = new Blob([data as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

@Component({
  selector: 'dialog-export-preview',
  templateUrl: './dialog-export-preview.component.html',
  styleUrls: ['./dialog-export-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButton, TranslatePipe],
})
export class DialogExportPreviewComponent {
  private readonly _dialogRef = inject(MatDialogRef<DialogExportPreviewComponent>);
  private readonly _timeEntryService = inject(TimeEntryService);
  readonly data = inject<DialogExportPreviewData>(MAT_DIALOG_DATA);

  readonly T = T;
  readonly formatCell = formatExportCell;

  async download(): Promise<void> {
    const { from, to } = this.data;
    const xlsx = await this._timeEntryService.createXlsxExport(from, to);
    downloadXlsxFile(xlsx, `time-entries_${from}_${to}.xlsx`);
    this._dialogRef.close();
  }
}
