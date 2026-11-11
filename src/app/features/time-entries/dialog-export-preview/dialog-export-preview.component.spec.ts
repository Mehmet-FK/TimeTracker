import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import {
  DialogExportPreviewComponent,
  DialogExportPreviewData,
  formatExportCell,
} from './dialog-export-preview.component';
import { strFromU8, unzipSync } from 'fflate';
import { LS } from '../../../core/persistence/storage-keys.const';
import { toExcelDateTime, toExcelDuration } from '../xlsx-writer';
import { T } from '../../../t.const';

describe('DialogExportPreviewComponent', () => {
  let fixture: ComponentFixture<DialogExportPreviewComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogExportPreviewComponent>>;
  let clickSpy: jasmine.Spy;

  const start = new Date(2026, 9, 10, 9, 0).getTime();

  const dataWithRows: DialogExportPreviewData = {
    from: '2026-10-01',
    to: '2026-10-31',
    table: {
      sheetName: 'Time entries',
      columns: [
        { id: 'date', header: 'Date', width: 12 },
        { id: 'start', header: 'Start', width: 8 },
        { id: 'duration', header: 'Duration', width: 10 },
        { id: 'durationHours', header: 'Duration (hours)', width: 16 },
        { id: 'task', header: 'Task', width: 40 },
      ],
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
      ],
    });
    fixture = TestBed.createComponent(DialogExportPreviewComponent);
    fixture.detectChanges();
    await settle();
  };

  const q = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  const headers = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('th')).map((el) =>
      (el as HTMLElement).textContent!.trim(),
    );
  const checkboxInput = (id: string): HTMLInputElement =>
    fixture.nativeElement.querySelector(`.export-column[data-column="${id}"] input`);

  beforeEach(() => {
    localStorage.removeItem(LS.TIME_ENTRIES_EXPORT_COLUMNS);
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL');
    clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
  });

  afterEach(() => localStorage.removeItem(LS.TIME_ENTRIES_EXPORT_COLUMNS));

  it('renders the headers and rows of the export', async () => {
    await create(dataWithRows);

    expect(headers()).toEqual(dataWithRows.table.columns.map((c) => c.header));
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

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.calls.mostRecent().object as HTMLAnchorElement;
    expect(anchor.download).toBe('time-entries_2026-10-01_2026-10-31.xlsx');
  });

  it('shows one checkbox per column', async () => {
    await create(dataWithRows);

    expect(fixture.nativeElement.querySelectorAll('.export-column').length).toBe(
      dataWithRows.table.columns.length,
    );
  });

  it('updates the table immediately when a column is toggled', async () => {
    await create(dataWithRows);

    checkboxInput('duration').click();
    await settle();

    expect(headers()).toEqual(['Date', 'Start', 'Duration (hours)', 'Task']);
    const cells = Array.from(fixture.nativeElement.querySelectorAll('tbody td')).map(
      (el) => (el as HTMLElement).textContent!.trim(),
    );
    expect(cells).toEqual(['2026-10-10', '09:00', '1.50', 'Write report']);

    checkboxInput('duration').click();
    await settle();

    expect(headers()).toEqual(dataWithRows.table.columns.map((c) => c.header));
  });

  it('disables the checkbox of the last selected column', async () => {
    localStorage.setItem(LS.TIME_ENTRIES_EXPORT_COLUMNS, JSON.stringify(['date']));
    await create(dataWithRows);

    expect(headers()).toEqual(['Date']);
    expect(checkboxInput('date').disabled).toBeTrue();
    expect(checkboxInput('start').disabled).toBeFalse();
  });

  it('downloads only the selected columns, as shown in the preview', async () => {
    await create(dataWithRows);
    checkboxInput('start').click();
    checkboxInput('durationHours').click();
    await settle();
    const shown = headers();
    let blob: Blob | undefined;
    (URL.createObjectURL as jasmine.Spy).and.callFake((b: Blob) => {
      blob = b;
      return 'blob:test';
    });

    q('.download-btn')!.click();
    await settle();

    const sheet = strFromU8(
      unzipSync(new Uint8Array(await blob!.arrayBuffer()))['xl/worksheets/sheet1.xml'],
    );
    expect(shown).toEqual(['Date', 'Duration', 'Task']);
    for (const header of shown) {
      expect(sheet).toContain(header);
    }
    expect(sheet).not.toContain('Start');
    expect(sheet).not.toContain('Duration (hours)');
  });

  it('downloads nothing when closed', async () => {
    await create(dataWithRows);

    q('.close-btn')!.click();
    await settle();

    expect(dialogRef.close).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  describe('formatExportCell', () => {
    it('formats empty and text cells', () => {
      expect(formatExportCell(null)).toBe('');
      expect(formatExportCell('abc')).toBe('abc');
    });
  });
});
