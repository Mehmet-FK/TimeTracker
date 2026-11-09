import { T } from '../../../t.const';
import { TIME_ENTRY_FIELDS } from '../time-entry-fields.const';

/**
 * Columns of the time entries XLSX export, in export order. The `id`s are
 * stored in the user's column selection: never rename or reuse one.
 * The order must match the cells built by buildTimeEntryExportRows.
 */
export interface ExportColumnDef {
  id: string;
  /** Translation key of the header. */
  label: string;
  width: number;
}

export const EXPORT_COLUMNS: readonly ExportColumnDef[] = [
  { id: 'date', label: T.F.TIME_ENTRIES.DATE, width: 12 },
  { id: 'start', label: T.F.TIME_ENTRIES.START, width: 8 },
  { id: 'end', label: T.F.TIME_ENTRIES.END, width: 8 },
  { id: 'duration', label: T.F.TIME_ENTRIES.DURATION, width: 10 },
  { id: 'durationHours', label: T.F.TIME_ENTRIES.DURATION_HOURS, width: 16 },
  { id: 'task', label: T.F.TIME_ENTRIES.TASK, width: 40 },
  { id: 'project', label: T.F.TIME_ENTRIES.PROJECT, width: 20 },
  ...TIME_ENTRY_FIELDS.map((f) => ({
    id: `field:${f.id}`,
    label: f.label,
    width: 20,
  })),
  { id: 'tags', label: T.F.TIME_ENTRIES.TAGS, width: 20 },
  { id: 'note', label: T.F.TIME_ENTRIES.NOTE, width: 60 },
];

export const ALL_EXPORT_COLUMN_IDS: readonly string[] = EXPORT_COLUMNS.map((c) => c.id);
