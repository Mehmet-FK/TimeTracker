import { computed, Injectable, signal } from '@angular/core';
import { LS } from '../../../core/persistence/storage-keys.const';
import { ALL_EXPORT_COLUMN_IDS } from './export-columns.const';

/**
 * The export columns the user chose, remembered in localStorage. Defaults to
 * all columns; unknown ids are dropped and the selection is never empty.
 */
@Injectable({
  providedIn: 'root',
})
export class ExportColumnSelectionService {
  private readonly _selectedIds = signal<ReadonlySet<string>>(this._load());

  /** Selected column ids in export (definition) order. */
  readonly selectedIds = computed<string[]>(() =>
    ALL_EXPORT_COLUMN_IDS.filter((id) => this._selectedIds().has(id)),
  );

  isSelected(id: string): boolean {
    return this._selectedIds().has(id);
  }

  /** Selects or deselects a column; the last selected column cannot be removed. */
  setSelected(id: string, isSelected: boolean): void {
    if (!ALL_EXPORT_COLUMN_IDS.includes(id)) {
      return;
    }
    const next = new Set(this._selectedIds());
    if (isSelected) {
      next.add(id);
    } else {
      next.delete(id);
    }
    if (next.size === 0) {
      return;
    }
    this._selectedIds.set(next);
    this._save(next);
  }

  private _load(): ReadonlySet<string> {
    const all = new Set(ALL_EXPORT_COLUMN_IDS);
    try {
      const raw = localStorage.getItem(LS.TIME_ENTRIES_EXPORT_COLUMNS);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        const known = parsed.filter((id): id is string => all.has(id));
        if (known.length) {
          return new Set(known);
        }
      }
    } catch {
      // corrupt value: fall back to all columns
    }
    return all;
  }

  private _save(ids: ReadonlySet<string>): void {
    try {
      localStorage.setItem(
        LS.TIME_ENTRIES_EXPORT_COLUMNS,
        JSON.stringify(ALL_EXPORT_COLUMN_IDS.filter((id) => ids.has(id))),
      );
    } catch {
      // storage unavailable: the selection just lasts for this session
    }
  }
}
