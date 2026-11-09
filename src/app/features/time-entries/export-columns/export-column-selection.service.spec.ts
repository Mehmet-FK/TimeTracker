import { TestBed } from '@angular/core/testing';
import { LS } from '../../../core/persistence/storage-keys.const';
import { ALL_EXPORT_COLUMN_IDS } from './export-columns.const';
import { ExportColumnSelectionService } from './export-column-selection.service';

describe('ExportColumnSelectionService', () => {
  const create = (): ExportColumnSelectionService => {
    TestBed.resetTestingModule();
    return TestBed.inject(ExportColumnSelectionService);
  };

  beforeEach(() => localStorage.removeItem(LS.TIME_ENTRIES_EXPORT_COLUMNS));
  afterEach(() => localStorage.removeItem(LS.TIME_ENTRIES_EXPORT_COLUMNS));

  it('selects all columns by default', () => {
    expect(create().selectedIds()).toEqual([...ALL_EXPORT_COLUMN_IDS]);
  });

  it('persists the selection and restores it in a new instance', () => {
    const service = create();
    service.setSelected('note', false);
    service.setSelected('project', false);

    const restored = create();

    expect(restored.isSelected('note')).toBeFalse();
    expect(restored.isSelected('project')).toBeFalse();
    expect(restored.selectedIds()).toEqual(
      ALL_EXPORT_COLUMN_IDS.filter((id) => id !== 'note' && id !== 'project'),
    );
  });

  it('keeps the definition order when a column is selected again', () => {
    const service = create();
    service.setSelected('date', false);
    service.setSelected('date', true);

    expect(service.selectedIds()).toEqual([...ALL_EXPORT_COLUMN_IDS]);
  });

  it('never allows an empty selection', () => {
    const service = create();
    for (const id of ALL_EXPORT_COLUMN_IDS) {
      service.setSelected(id, false);
    }

    expect(service.selectedIds()).toEqual([ALL_EXPORT_COLUMN_IDS.at(-1) as string]);
  });

  it('ignores unknown ids when loading and setting', () => {
    localStorage.setItem(
      LS.TIME_ENTRIES_EXPORT_COLUMNS,
      JSON.stringify(['note', 'unknown', 'task']),
    );
    const service = create();

    expect(service.selectedIds()).toEqual(['task', 'note']);

    service.setSelected('bogus', true);
    expect(service.selectedIds()).toEqual(['task', 'note']);
  });

  it('falls back to all columns for an empty, unknown-only or corrupt value', () => {
    for (const raw of ['[]', '["x"]', 'not json', '{"a":1}']) {
      localStorage.setItem(LS.TIME_ENTRIES_EXPORT_COLUMNS, raw);
      expect(create().selectedIds()).toEqual([...ALL_EXPORT_COLUMN_IDS]);
    }
  });
});
