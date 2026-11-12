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
import { GENERAL_MODULE_ID } from '../module.const';
import { Module } from '../module.model';
import { isValidIconUrl } from '../module.validator';

export interface DialogEditModuleData {
  /** The module to edit; without it the dialog creates a new module. */
  module?: Module;
}

/** Trimmed values of a saved dialog; empty optional fields are undefined. */
export type DialogEditModuleResult = Pick<Module, 'name' | 'description' | 'iconUrl'>;

@Component({
  selector: 'dialog-edit-module',
  templateUrl: './dialog-edit-module.component.html',
  styleUrl: './dialog-edit-module.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButton, MatFormField, MatLabel, MatInput, TranslatePipe],
})
export class DialogEditModuleComponent {
  private readonly _dialogRef =
    inject<MatDialogRef<DialogEditModuleComponent, DialogEditModuleResult>>(MatDialogRef);
  private readonly _data = inject<DialogEditModuleData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly T = T;
  readonly isEdit = !!this._data?.module;
  // GENERAL is shown read-only; editing is blocked
  readonly isGeneral = this._data?.module?.id === GENERAL_MODULE_ID;

  readonly name = signal(this._data?.module?.name ?? '');
  readonly description = signal(this._data?.module?.description ?? '');
  readonly iconUrl = signal(this._data?.module?.iconUrl ?? '');
  /** The name error shows once the user has touched the field. */
  readonly isNameTouched = signal(false);

  readonly isNameInvalid = computed(() => !this.name().trim());
  readonly isIconUrlInvalid = computed(
    () => !!this.iconUrl().trim() && !isValidIconUrl(this.iconUrl().trim()),
  );
  readonly isFormValid = computed(
    () => !this.isNameInvalid() && !this.isIconUrlInvalid() && !this.isGeneral,
  );

  save(): void {
    if (!this.isFormValid()) {
      return;
    }
    this._dialogRef.close({
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      iconUrl: this.iconUrl().trim() || undefined,
    });
  }
}
