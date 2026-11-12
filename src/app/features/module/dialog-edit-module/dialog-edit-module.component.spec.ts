import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import {
  DialogEditModuleComponent,
  DialogEditModuleData,
} from './dialog-edit-module.component';
import { GENERAL_MODULE } from '../module.const';
import { Module } from '../module.model';
import { T } from '../../../t.const';

describe('DialogEditModuleComponent', () => {
  let fixture: ComponentFixture<DialogEditModuleComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogEditModuleComponent>>;

  const existing: Module = {
    id: 'm1',
    name: 'One',
    description: 'Desc one',
    iconUrl: 'https://x.test/a.png',
  };

  const create = async (data: DialogEditModuleData): Promise<void> => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [
        DialogEditModuleComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    fixture = TestBed.createComponent(DialogEditModuleComponent);
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

  const saveBtn = (): HTMLButtonElement => q<HTMLButtonElement>('.module-save-btn');

  const submit = (): void => {
    q<HTMLFormElement>('form.module-form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  describe('add', () => {
    beforeEach(() => create({}));

    it('shows the add title and empty name, description and icon URL fields', () => {
      expect(q('[mat-dialog-title]').textContent!.trim()).toBe(T.F.MODULE.ADD);
      expect(q<HTMLInputElement>('.module-name').value).toBe('');
      expect(q<HTMLInputElement>('.module-description').value).toBe('');
      expect(q<HTMLInputElement>('.module-icon-url').value).toBe('');
      // the fields live in the scrollable dialog content
      expect(q('mat-dialog-content').querySelectorAll('input').length).toBe(3);
    });

    it('disables save while the name is empty and shows the error once touched', () => {
      expect(saveBtn().disabled).toBeTrue();
      expect(q('.module-name-error')).toBeNull();

      setInput('.module-name', '   ');
      expect(saveBtn().disabled).toBeTrue();
      expect(q('.module-name-error')).not.toBeNull();

      submit();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('shows an error for an invalid icon URL and blocks saving', () => {
      setInput('.module-name', 'Name');
      setInput('.module-icon-url', 'not a url');
      expect(q('.module-icon-url-error')).not.toBeNull();
      expect(saveBtn().disabled).toBeTrue();

      setInput('.module-icon-url', 'ftp://x.test/i.png');
      expect(q('.module-icon-url-error')).not.toBeNull();
      expect(saveBtn().disabled).toBeTrue();

      setInput('.module-icon-url', 'https://example.com/i.png');
      expect(q('.module-icon-url-error')).toBeNull();
      expect(saveBtn().disabled).toBeFalse();
    });

    it('closes with the trimmed values; empty optional fields are undefined', () => {
      setInput('.module-name', ' Docs ');
      setInput('.module-description', '   ');
      submit();

      expect(dialogRef.close).toHaveBeenCalledOnceWith({
        name: 'Docs',
        description: undefined,
        iconUrl: undefined,
      });
    });

    it('closes without a result on cancel', () => {
      setInput('.module-name', 'Docs');
      q<HTMLButtonElement>('.module-cancel-btn').click();
      fixture.detectChanges();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      expect(dialogRef.close.calls.mostRecent().args[0]).toBeFalsy();
    });
  });

  describe('edit', () => {
    beforeEach(() => create({ module: existing }));

    it('shows the edit title and the filled fields', () => {
      expect(q('[mat-dialog-title]').textContent!.trim()).toBe(T.F.MODULE.EDIT);
      expect(q<HTMLInputElement>('.module-name').value).toBe('One');
      expect(q<HTMLInputElement>('.module-description').value).toBe('Desc one');
      expect(q<HTMLInputElement>('.module-icon-url').value).toBe('https://x.test/a.png');
      expect(saveBtn().disabled).toBeFalse();
    });

    it('closes with the changed, trimmed values', () => {
      setInput('.module-name', ' One v2 ');
      setInput('.module-description', ' New desc ');
      setInput('.module-icon-url', ' https://x.test/b.png ');
      submit();

      expect(dialogRef.close).toHaveBeenCalledOnceWith({
        name: 'One v2',
        description: 'New desc',
        iconUrl: 'https://x.test/b.png',
      });
    });
  });

  describe('GENERAL', () => {
    beforeEach(() => create({ module: GENERAL_MODULE }));

    it('shows the fields read-only and refuses to save', () => {
      expect(q<HTMLInputElement>('.module-name').readOnly).toBeTrue();
      expect(q<HTMLInputElement>('.module-description').readOnly).toBeTrue();
      expect(q<HTMLInputElement>('.module-icon-url').readOnly).toBeTrue();
      expect(q('.module-hint')).not.toBeNull();
      expect(saveBtn().disabled).toBeTrue();

      fixture.componentInstance.save();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
