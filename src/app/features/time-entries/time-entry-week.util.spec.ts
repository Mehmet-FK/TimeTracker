import { getWeekStartDay, layoutWeek } from './time-entry-week.util';
import { combineDayAndTime } from './time-entry.util';

const H = 60 * 60 * 1000;
const at = (day: string, time: string): number => combineDayAndTime(day, time);
const item = (
  id: string,
  start: number,
  end: number,
): { id: string; start: number; end: number } => ({ id, start, end });

describe('time-entry-week.util', () => {
  describe('getWeekStartDay', () => {
    it('returns the Monday of the week', () => {
      // 2026-10-12 is a Monday
      expect(getWeekStartDay('2026-10-12')).toBe('2026-10-12');
      expect(getWeekStartDay('2026-10-15')).toBe('2026-10-12');
      expect(getWeekStartDay('2026-10-18')).toBe('2026-10-12');
    });

    it('goes back across a month boundary', () => {
      expect(getWeekStartDay('2026-11-01')).toBe('2026-10-26');
    });
  });

  describe('layoutWeek', () => {
    it('returns seven days from Monday with their totals', () => {
      const days = layoutWeek('2026-10-12', [
        item('a', at('2026-10-13', '09:00'), at('2026-10-13', '10:30')),
        item('b', at('2026-10-13', '12:00'), at('2026-10-13', '13:00')),
      ]);

      expect(days.map((d) => d.day)).toEqual([
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
        '2026-10-15',
        '2026-10-16',
        '2026-10-17',
        '2026-10-18',
      ]);
      expect(days[0].total).toBe(0);
      expect(days[1].total).toBe(2.5 * H);
    });

    it('places a block by its start and end time', () => {
      const [, tuesday] = layoutWeek('2026-10-12', [
        item('a', at('2026-10-13', '06:00'), at('2026-10-13', '12:00')),
      ]);

      expect(tuesday.blocks).toEqual([
        { item: jasmine.anything(), top: 25, height: 25, column: 0, columnCount: 1 },
      ]);
    });

    it('splits an item crossing midnight onto both days', () => {
      const days = layoutWeek('2026-10-12', [
        item('a', at('2026-10-12', '23:00'), at('2026-10-13', '01:00')),
      ]);

      expect(days[0].total).toBe(H);
      expect(days[0].blocks[0].top).toBeCloseTo((23 / 24) * 100);
      expect(days[1].total).toBe(H);
      expect(days[1].blocks[0].top).toBe(0);
    });

    it('leaves out items outside the week', () => {
      const days = layoutWeek('2026-10-12', [
        item('a', at('2026-10-11', '09:00'), at('2026-10-11', '10:00')),
        item('b', at('2026-10-19', '09:00'), at('2026-10-19', '10:00')),
      ]);

      expect(days.every((d) => !d.blocks.length)).toBeTrue();
    });

    it('puts overlapping items side by side', () => {
      const [monday] = layoutWeek('2026-10-12', [
        item('a', at('2026-10-12', '09:00'), at('2026-10-12', '11:00')),
        item('b', at('2026-10-12', '10:00'), at('2026-10-12', '12:00')),
        item('c', at('2026-10-12', '11:00'), at('2026-10-12', '12:00')),
        // not overlapping any of the above
        item('d', at('2026-10-12', '14:00'), at('2026-10-12', '15:00')),
      ]);

      const placement = monday.blocks.map(
        (b) => `${b.item.id}:${b.column}/${b.columnCount}`,
      );
      expect(placement).toEqual(['a:0/2', 'b:1/2', 'c:0/2', 'd:0/1']);
    });
  });
});
