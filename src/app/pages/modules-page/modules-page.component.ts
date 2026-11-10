import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { T } from '../../t.const';
import { ModuleService } from '../../features/module/module.service';
import { GENERAL_MODULE_ID } from '../../features/module/module.const';
import { isValidIconUrl } from '../../features/module/module.validator';
import { Module } from '../../features/module/module.model';
import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';

@Component({
  selector: 'modules-page',
  templateUrl: './modules-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatError,
    MatIcon,
    MatInput,
    TranslatePipe,
  ],
})
export class ModulesPageComponent {
  private readonly _moduleService = inject(ModuleService);
  private readonly _matDialog = inject(MatDialog);

  readonly T = T;
  readonly GENERAL_MODULE_ID = GENERAL_MODULE_ID;
  readonly modules = this._moduleService.modules;

  /** null = form closed; '' = creating; otherwise id of the edited module. */
  readonly editingId = signal<string | null>(null);
  readonly name = signal('');
  readonly description = signal('');
  readonly iconUrl = signal('');

  readonly isGeneralSelected = computed(() => this.editingId() === GENERAL_MODULE_ID);
  readonly isNameInvalid = computed(() => !this.name().trim());
  readonly isIconUrlInvalid = computed(
    () => !!this.iconUrl().trim() && !isValidIconUrl(this.iconUrl().trim()),
  );
  readonly isFormValid = computed(
    () => !this.isNameInvalid() && !this.isIconUrlInvalid() && !this.isGeneralSelected(),
  );

  startAdd(): void {
    this._setForm('', '', '', '');
  }

  startEdit(module: Module): void {
    // GENERAL is shown read-only; editing is blocked
    this._setForm(module.id, module.name, module.description || '', module.iconUrl || '');
  }

  cancel(): void {
    this.editingId.set(null);
  }

  save(): void {
    if (!this.isFormValid()) {
      return;
    }
    const props = {
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      iconUrl: this.iconUrl().trim() || undefined,
    };
    const id = this.editingId();
    if (id) {
      this._moduleService.update(id, props);
    } else {
      this._moduleService.add(props);
    }
    this.editingId.set(null);
  }

  async remove(module: Module): Promise<void> {
    if (module.id === GENERAL_MODULE_ID) {
      return;
    }
    const isConfirmed = await firstValueFrom(
      this._matDialog
        .open(DialogConfirmComponent, {
          restoreFocus: true,
          data: {
            message: T.F.MODULE.DELETE_CONFIRM,
            okTxt: T.F.MODULE.DELETE,
          },
        })
        .afterClosed(),
    );
    if (isConfirmed) {
      this._moduleService.delete(module.id);
      if (this.editingId() === module.id) {
        this.editingId.set(null);
      }
    }
  }

  private _setForm(id: string, name: string, description: string, iconUrl: string): void {
    // '' id means "create": store as empty string so the form shows
    this.editingId.set(id);
    this.name.set(name);
    this.description.set(description);
    this.iconUrl.set(iconUrl);
  }
}
