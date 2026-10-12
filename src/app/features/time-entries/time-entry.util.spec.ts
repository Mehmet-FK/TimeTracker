/* eslint-disable @typescript-eslint/naming-convention */
import {
  applyEntryToTimeSpentOnDay,
  combineDayAndTime,
  getDayDiff,
  getInheritedFieldValues,
  getRangeForLogicalDay,
  getRangeWithDate,
  getRangeWithEndTime,
  getRangeWithStartTime,
  isEntryOnDay,
  normalizeFieldValues,
  shiftByDays,
  splitDurationByDay,
  toTimeInputValue,
} from './time-entry.util';

const H = 60 * 60 * 1000;
const at = (day: string, time: string): number => combineDayAndTime(day, time);

describe('time-entry.util', () => {
  describe('splitDurationByDay', () => {
    it('keeps a range within one day on that day', () => {
      expect(
        splitDurationByDay(at('2026-10-10', '09:00'), at('2026-10-10', '11:30'), 0),
      ).toEqual({ '2026-10-10': 2.5 * H });
    });

    it('splits a range crossing midnight', () => {
      expect(
        splitDurationByDay(at('2026-10-10', '23:00'), at('2026-10-11', '01:00'), 0),
      ).toEqual({ '2026-10-10': H, '2026-10-11': H });
    });

    it('honours the start of the next day offset', () => {
      // with days starting at 04:00, 01:00-03:00 still belongs to the previous day
      expect(
        splitDurationByDay(at('2026-10-11', '01:00'), at('2026-10-11', '05:00'), 4 * H),
      ).toEqual({ '2026-10-10': 3 * H, '2026-10-11': H });
    });
  });

  describe('applyEntryToTimeSpentOnDay', () => {
    const entry = { start: at('2026-10-10', '09:00'), end: at('2026-10-10', '10:00') };

    it('adds the duration', () => {
      expect(applyEntryToTimeSpentOnDay({ '2026-10-10': H }, entry, 1, 0)).toEqual({
        '2026-10-10': 2 * H,
      });
    });

    it('removes the duration and drops days reaching zero', () => {
      expect(
        applyEntryToTimeSpentOnDay({ '2026-10-10': H, '2026-10-09': H }, entry, -1, 0),
      ).toEqual({ '2026-10-09': H });
    });

    it('never goes below zero', () => {
      expect(applyEntryToTimeSpentOnDay({ '2026-10-10': H / 2 }, entry, -1, 0)).toEqual(
        {},
      );
    });
  });

  it('isEntryOnDay matches both days of a midnight-crossing entry', () => {
    const entry = { start: at('2026-10-10', '23:00'), end: at('2026-10-11', '01:00') };
    expect(isEntryOnDay(entry, '2026-10-10', 0)).toBe(true);
    expect(isEntryOnDay(entry, '2026-10-11', 0)).toBe(true);
    expect(isEntryOnDay(entry, '2026-10-12', 0)).toBe(false);
  });

  it('toTimeInputValue formats local time as HH:mm', () => {
    expect(toTimeInputValue(at('2026-10-10', '07:05'))).toBe('07:05');
  });

  it('combineDayAndTime returns NaN for malformed input', () => {
    expect(combineDayAndTime('2026-10-10', '')).toBeNaN();
    expect(combineDayAndTime('', '10:00')).toBeNaN();
  });

  describe('getRangeForLogicalDay', () => {
    it('uses the given day', () => {
      expect(getRangeForLogicalDay('2026-10-10', '09:00', '10:00', 0)).toEqual({
        start: at('2026-10-10', '09:00'),
        end: at('2026-10-10', '10:00'),
      });
    });

    it('moves an end before the start to the next day', () => {
      expect(getRangeForLogicalDay('2026-10-10', '23:00', '01:00', 0)).toEqual({
        start: at('2026-10-10', '23:00'),
        end: at('2026-10-11', '01:00'),
      });
    });

    it('puts times before the start of the day on the next calendar day', () => {
      expect(getRangeForLogicalDay('2026-10-10', '02:00', '03:00', 4 * H)).toEqual({
        start: at('2026-10-11', '02:00'),
        end: at('2026-10-11', '03:00'),
      });
    });
  });

  it('shiftByDays keeps the local time of day', () => {
    expect(shiftByDays(at('2026-10-10', '09:00'), 2)).toBe(at('2026-10-12', '09:00'));
    // across the DST change in Europe/Berlin (2026-10-25)
    expect(shiftByDays(at('2026-10-24', '09:00'), 2)).toBe(at('2026-10-26', '09:00'));
  });

  it('getDayDiff counts calendar days', () => {
    expect(getDayDiff('2026-10-10', '2026-10-12')).toBe(2);
    expect(getDayDiff('2026-10-12', '2026-10-10')).toBe(-2);
    expect(getDayDiff('2026-10-24', '2026-10-26')).toBe(2);
  });

  describe('normalizeFieldValues', () => {
    it('trims values and drops empty ones', () => {
      expect(normalizeFieldValues({ a: ' x ', b: '  ', c: '' })).toEqual({ a: 'x' });
    });

    it('returns undefined when nothing is left', () => {
      expect(normalizeFieldValues({ a: ' ' })).toBeUndefined();
      expect(normalizeFieldValues(undefined)).toBeUndefined();
    });

    it('limits the length', () => {
      expect(normalizeFieldValues({ a: 'x'.repeat(500) })?.a.length).toBe(200);
    });
  });

  describe('getInheritedFieldValues', () => {
    it('takes inheritable values from the latest entry', () => {
      expect(
        getInheritedFieldValues([
          { id: '1', start: 0, end: 300, fields: { requestedBy: 'Ben', unknown: 'x' } },
          { id: '2', start: 0, end: 100, fields: { requestedBy: 'Anna' } },
        ]),
      ).toEqual({ requestedBy: 'Ben' });
    });

    it('returns nothing without entries', () => {
      expect(getInheritedFieldValues(undefined)).toEqual({});
    });
  });

  describe('range changes', () => {
    const entry = { start: at('2026-10-10', '09:00'), end: at('2026-10-10', '10:00') };

    it('changes the start time, rejecting a start after the end', () => {
      expect(getRangeWithStartTime(entry, '08:30')).toEqual({
        start: at('2026-10-10', '08:30'),
        end: entry.end,
      });
      expect(getRangeWithStartTime(entry, '10:30')).toBeNull();
      expect(getRangeWithStartTime(entry, '')).toBeNull();
    });

    it('changes the end time, an earlier end running past midnight', () => {
      expect(getRangeWithEndTime(entry, '11:00')?.end).toBe(at('2026-10-10', '11:00'));
      expect(getRangeWithEndTime(entry, '01:00')?.end).toBe(at('2026-10-11', '01:00'));
      expect(getRangeWithEndTime(entry, '')).toBeNull();
    });

    it('moves the range to another day', () => {
      expect(getRangeWithDate(entry, '2026-10-12')).toEqual({
        start: at('2026-10-12', '09:00'),
        end: at('2026-10-12', '10:00'),
      });
      expect(getRangeWithDate(entry, '')).toBeNull();
    });
  });
});
