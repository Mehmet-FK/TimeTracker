import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import {
  DialogExportRangeComponent,
  DialogExportRangeData,
} from './dialog-export-range.component';
import { T } from '../../../t.const';

describe('DialogExportRangeComponent', () => {
  let fixture: ComponentFixture<DialogExportRangeComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogExportRangeComponent>>;

  const create = async (data: DialogExportRangeData): Promise<void> => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [
        DialogExportRangeComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    fixture = TestBed.createComponent(DialogExportRangeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const q = <E extends HTMLElement = HTMLElement>(selector: string): E =>
    fixture.nativeElement.querySelector(selector);

  const setInput = (selector: string, value: string): void => {
    const input = q<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const confirmBtn = (): HTMLButtonElement =>
    q<HTMLButtonElement>('.export-range-confirm-btn');

  const submit = (): void => {
    q<HTMLFormElement>('form.export-range-form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(() => create({ from: '2026-10-01', to: '2026-10-14' }));

  it('shows the title and the given From and To dates', () => {
    expect(q('[mat-dialog-title]').textContent!.trim()).toBe(
      T.F.TIME_ENTRIES.EXPORT_RANGE_TITLE,
    );
    expect(q<HTMLInputElement>('input.export-from').type).toBe('date');
    expect(q<HTMLInputElement>('input.export-from').value).toBe('2026-10-01');
    expect(q<HTMLInputElement>('input.export-to').value).toBe('2026-10-14');
    expect(confirmBtn().disabled).toBeFalse();
    expect(q('.export-range-error')).toBeNull();
  });

  it('closes with the chosen range on confirm', () => {
    setInput('input.export-from', '2026-09-01');
    setInput('input.export-to', '2026-09-30');
    confirmBtn().click();
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledOnceWith({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('accepts a single day (from equals to)', () => {
    setInput('input.export-to', '2026-10-01');
    submit();

    expect(dialogRef.close).toHaveBeenCalledOnceWith({
      from: '2026-10-01',
      to: '2026-10-01',
    });
  });

  it('shows the range error and blocks confirm when from is after to', () => {
    setInput('input.export-from', '2026-10-31');

    expect(q('.export-range-error')!.textContent!.trim()).toBe(
      T.F.TIME_ENTRIES.ERR_EXPORT_RANGE,
    );
    expect(confirmBtn().disabled).toBeTrue();
    submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('blocks confirm when a date is empty', () => {
    setInput('input.export-to', '');

    expect(confirmBtn().disabled).toBeTrue();
    submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes without a range on cancel', () => {
    q<HTMLButtonElement>('.export-range-cancel-btn').click();
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(dialogRef.close.calls.mostRecent().args[0]).toBeFalsy();
  });
});
