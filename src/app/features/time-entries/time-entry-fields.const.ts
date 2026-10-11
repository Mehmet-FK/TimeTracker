import { T } from '../../t.const';

/**
 * Custom fields of a time entry. Values are stored per entry in
 * `TimeEntry.fields`, keyed by the field `id`.
 *
 * To add a field, add a definition here and its label to en.json/t.const.ts.
 * The time entries page (and the export) pick it up automatically.
 * Never rename or reuse an `id`: stored entries keep their values under it.
 */
export interface TimeEntryFieldDef {
  id: string;
  /** Translation key of the label. */
  label: string;
  type: 'text';
  /** Suggest values already used on other entries, to keep spelling consistent. */
  isSuggestUsedValues: boolean;
  /**
   * A new entry of a task starts with the value of the task's latest entry,
   * e.g. a task usually stays requested by the same person.
   */
  isInheritFromPreviousEntry: boolean;
}

export const TIME_ENTRY_FIELDS: readonly TimeEntryFieldDef[] = [
  {
    id: 'requestedBy',
    label: T.F.TIME_ENTRIES.FIELDS.REQUESTED_BY,
    type: 'text',
    isSuggestUsedValues: true,
    isInheritFromPreviousEntry: true,
  },
];

export const TIME_ENTRY_FIELD_MAX_LENGTH = 200;
