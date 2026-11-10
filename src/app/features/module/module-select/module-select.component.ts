import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { ModuleService } from '../module.service';
import { GENERAL_MODULE_ID } from '../module.const';

/**
 * Multi-select for the modules of a task. With nothing selected, GENERAL is
 * shown as the default (the store links such tasks to GENERAL as well).
 */
@Component({
  selector: 'module-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormField, MatLabel, MatSelect, MatOption, TranslatePipe],
  template: `
    <mat-form-field class="module-select-field">
      <mat-label>{{ T.F.MODULE.TASK_MODULES | translate }}</mat-label>
      <mat-select
        multiple
        [value]="displayedIds()"
        (selectionChange)="onChange($event.value)"
      >
        @for (module of modules(); track module.id) {
          <mat-option [value]="module.id">{{ module.name }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
})
export class ModuleSelectComponent {
  private readonly _moduleService = inject(ModuleService);

  readonly T = T;
  readonly moduleIds = input<string[] | undefined>([]);
  readonly moduleIdsChange = output<string[]>();

  readonly modules = this._moduleService.modules;
  readonly displayedIds = computed(() => {
    const ids = this.moduleIds();
    return ids && ids.length ? ids : [GENERAL_MODULE_ID];
  });

  onChange(ids: string[]): void {
    this.moduleIdsChange.emit(ids);
  }
}
