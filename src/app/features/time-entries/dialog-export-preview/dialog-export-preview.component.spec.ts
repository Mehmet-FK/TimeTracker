import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import {
  DialogExportPreviewComponent,
  DialogExportPreviewData,
  formatExportCell,
} from './dialog-export-preview.component';
import { TimeEntryService } from '../time-entry.service';
import { toExcelDateTime, toExcelDuration } from '../xlsx-writer';
import { T } from '../../../t.const';

describe('DialogExportPreviewComponent', () => {
  let fixture: ComponentFixture<DialogExportPreviewComponent>;
  let timeEntryService: jasmine.SpyObj<TimeEntryService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogExportPreviewComponent>>;
  let clickSpy: jasmine.Spy;

  const start = new Date(2026, 9, 10, 9, 0).getTime();

  const dataWithRows: DialogExportPreviewData = {
    from: '2026-10-01',
    to: '2026-10-31',
    table: {
      sheetName: 'Time entries',
      headers: ['Date', 'Start', 'Duration', 'Duration (hours)', 'Task'],
      columns: [],
      rows: [
        [
          { value: toExcelDateTime(start), format: 'date' },
          { value: toExcelDateTime(start), format: 'time' },
          { value: toExcelDuration(90 * 60 * 1000), format: 'duration' },
          { value: 1.5, format: 'decimal' },
          'Write report',
        ],
      ],
    },
  };

  // the dialog downloads after plain promises, which zoneless whenStable() does not track
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
  };

  const create = async (data: DialogExportPreviewData): Promise<void> => {
    TestBed.configureTestingModule({
      imports: [
        DialogExportPreviewComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: TimeEntryService, useValue: timeEntryService },
      ],
    });
    fixture = TestBed.createComponent(DialogExportPreviewComponent);
    fixture.detectChanges();
    await settle();
  };

  const q = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  beforeEach(() => {
    timeEntryService = jasmine.createSpyObj<TimeEntryService>('TimeEntryService', [
      'createXlsxExport',
    ]);
    timeEntryService.createXlsxExport.and.resolveTo(new Uint8Array([1, 2, 3]));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL');
    clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
  });

  it('renders the headers and rows of the export', async () => {
    await create(dataWithRows);

    const headers = Array.from(fixture.nativeElement.querySelectorAll('th')).map((el) =>
      (el as HTMLElement).textContent!.trim(),
    );
    expect(headers).toEqual(dataWithRows.table.headers);
    const cells = Array.from(fixture.nativeElement.querySelectorAll('tbody td')).map(
      (el) => (el as HTMLElement).textContent!.trim(),
    );
    expect(cells).toEqual(['2026-10-10', '09:00', '1:30', '1.50', 'Write report']);
    expect(q('.empty')).toBeNull();
  });

  it('shows the empty state without rows', async () => {
    await create({ ...dataWithRows, table: { ...dataWithRows.table, rows: [] } });

    expect(q('table')).toBeNull();
    expect(q('.empty')!.textContent).toContain(T.F.TIME_ENTRIES.PREVIEW_EMPTY);
  });

  it('downloads the xlsx when Download is pressed', async () => {
    await create(dataWithRows);
    expect(clickSpy).not.toHaveBeenCalled();

    q('.download-btn')!.click();
    await settle();

    expect(timeEntryService.createXlsxExport).toHaveBeenCalledWith(
      '2026-10-01',
      '2026-10-31',
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.calls.mostRecent().object as HTMLAnchorElement;
    expect(anchor.download).toBe('time-entries_2026-10-01_2026-10-31.xlsx');
  });

  it('downloads nothing when closed', async () => {
    await create(dataWithRows);

    q('.close-btn')!.click();
    await settle();

    expect(dialogRef.close).toHaveBeenCalled();
    expect(timeEntryService.createXlsxExport).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  describe('formatExportCell', () => {
    it('formats empty and text cells', () => {
      expect(formatExportCell(null)).toBe('');
      expect(formatExportCell('abc')).toBe('abc');
    });
  });
});
