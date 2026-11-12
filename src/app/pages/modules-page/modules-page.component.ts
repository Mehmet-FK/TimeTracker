import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { selectAllTasksInActiveProjects } from '../../features/tasks/store/task.selectors';
import { Task } from '../../features/tasks/task.model';
import { T } from '../../t.const';
import { ModuleHasTasksError, ModuleService } from '../../features/module/module.service';
import { SnackService } from '../../core/snack/snack.service';
import { GENERAL_MODULE_ID } from '../../features/module/module.const';
import { Module } from '../../features/module/module.model';
import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';
import {
  DialogEditModuleComponent,
  DialogEditModuleData,
  DialogEditModuleResult,
} from '../../features/module/dialog-edit-module/dialog-edit-module.component';

@Component({
  selector: 'modules-page',
  templateUrl: './modules-page.component.html',
  styleUrl: './modules-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIconButton, MatIcon, TranslatePipe],
})
export class ModulesPageComponent {
  private readonly _moduleService = inject(ModuleService);
  private readonly _matDialog = inject(MatDialog);
  private readonly _store = inject(Store);
  private readonly _snackService = inject(SnackService);

  readonly T = T;
  readonly GENERAL_MODULE_ID = GENERAL_MODULE_ID;
  readonly modules = this._moduleService.modules;
  private readonly _tasks = this._store.selectSignal(selectAllTasksInActiveProjects);

  /** Module ids whose icon failed to load. */
  readonly brokenIconIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedModuleId = signal<string | null>(null);

  /** Non-archived tasks per module; tasks without moduleIds count as GENERAL. */
  readonly tasksByModule = computed(() => {
    const map = new Map<string, Task[]>();
    for (const task of this._tasks()) {
      const ids = task.moduleIds?.length ? task.moduleIds : [GENERAL_MODULE_ID];
      for (const id of new Set(ids)) {
        const list = map.get(id);
        if (list) {
          list.push(task);
        } else {
          map.set(id, [task]);
        }
      }
    }
    return map;
  });
  readonly selectedModule = computed(
    () => this.modules().find((m) => m.id === this.selectedModuleId()) ?? null,
  );
  readonly selectedTasks = computed(
    () => this.tasksByModule().get(this.selectedModuleId() ?? '') ?? [],
  );
  readonly showCreateHint = computed(() =>
    this.modules().every((m) => m.id === GENERAL_MODULE_ID),
  );

  taskCount(moduleId: string): number {
    return this.tasksByModule().get(moduleId)?.length ?? 0;
  }

  onIconError(moduleId: string): void {
    this.brokenIconIds.update((s) => new Set(s).add(moduleId));
  }

  selectModule(moduleId: string): void {
    this.selectedModuleId.set(this.selectedModuleId() === moduleId ? null : moduleId);
  }

  closeTasks(): void {
    this.selectedModuleId.set(null);
  }

  async startAdd(): Promise<void> {
    const result = await this._openEditDialog({});
    if (result) {
      this._moduleService.add(result);
    }
  }

  async startEdit(module: Module): Promise<void> {
    // GENERAL is read-only; editing is blocked
    if (module.id === GENERAL_MODULE_ID) {
      return;
    }
    const result = await this._openEditDialog({ module });
    if (result) {
      this._moduleService.update(module.id, result);
    }
  }

  private _openEditDialog(
    data: DialogEditModuleData,
  ): Promise<DialogEditModuleResult | undefined> {
    return firstValueFrom(
      this._matDialog
        .open<DialogEditModuleComponent, DialogEditModuleData, DialogEditModuleResult>(
          DialogEditModuleComponent,
          {
            restoreFocus: true,
            width: '480px',
            maxWidth: '100vw',
            maxHeight: '90vh',
            data,
          },
        )
        .afterClosed(),
    );
  }

  async remove(module: Module): Promise<void> {
    if (module.id === GENERAL_MODULE_ID) {
      return;
    }
    const linked = this.taskCount(module.id);
    if (linked > 0) {
      this._warnHasTasks(linked);
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
      try {
        this._moduleService.delete(module.id);
      } catch (e) {
        if (e instanceof ModuleHasTasksError) {
          // e.g. tasks of archived projects, not counted on this page
          this._warnHasTasks(e.count);
          return;
        }
        throw e;
      }
      if (this.selectedModuleId() === module.id) {
        this.selectedModuleId.set(null);
      }
    }
  }

  private _warnHasTasks(count: number): void {
    this._snackService.open({
      type: 'ERROR',
      msg: T.F.MODULE.DELETE_HAS_TASKS,
      translateParams: { count },
    });
  }
}
