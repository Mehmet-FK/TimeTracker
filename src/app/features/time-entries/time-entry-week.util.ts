import { combineDayAndTime, getCalendarDayStr } from './time-entry.util';

/** The part of an item falling on one day, placed in the day's column. */
export interface WeekBlock<T> {
  item: T;
  /** Offset and size within the day, in percent of the day. */
  top: number;
  height: number;
  /** Side by side placement of overlapping blocks. */
  column: number;
  columnCount: number;
}

export interface WeekDay<T> {
  day: string;
  dayStart: number;
  /** Time of all items falling on the day. */
  total: number;
  blocks: WeekBlock<T>[];
}

/** Monday ('YYYY-MM-DD') of the week containing the given day. */
export const getWeekStartDay = (day: string): string => {
  const d = new Date(combineDayAndTime(day, '12:00'));
  // getDay(): 0 = Sunday
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return getCalendarDayStr(d.getTime());
};

/**
 * Places items on the seven calendar days starting with `weekStartDay`.
 * Items crossing midnight are split; overlapping items share the width.
 */
export const layoutWeek = <T extends { start: number; end: number }>(
  weekStartDay: string,
  items: T[],
): WeekDay<T>[] =>
  Array.from({ length: 7 }, (_, i) => {
    const dayStart = combineDayAndTime(weekStartDay, '00:00', i);
    const dayEnd = combineDayAndTime(weekStartDay, '00:00', i + 1);
    const dayLength = dayEnd - dayStart;

    const pieces = items
      .filter((item) => item.start < dayEnd && item.end > dayStart)
      .map((item) => ({
        item,
        start: Math.max(item.start, dayStart),
        end: Math.min(item.end, dayEnd),
      }))
      .sort((a, b) => a.start - b.start || b.end - a.end);

    const blocks: WeekBlock<T>[] = [];
    let total = 0;
    // overlapping pieces form a cluster; each piece takes the first free column
    let cluster: WeekBlock<T>[] = [];
    let columnEnds: number[] = [];
    let clusterEnd = -Infinity;
    const closeCluster = (): void => {
      cluster.forEach((block) => (block.columnCount = columnEnds.length));
      cluster = [];
      columnEnds = [];
    };

    for (const piece of pieces) {
      if (piece.start >= clusterEnd) {
        closeCluster();
      }
      let column = columnEnds.findIndex((end) => end <= piece.start);
      if (column === -1) {
        column = columnEnds.length;
      }
      columnEnds[column] = piece.end;
      clusterEnd = Math.max(clusterEnd, piece.end);

      const block: WeekBlock<T> = {
        item: piece.item,
        top: ((piece.start - dayStart) / dayLength) * 100,
        height: ((piece.end - piece.start) / dayLength) * 100,
        column,
        columnCount: 1,
      };
      cluster.push(block);
      blocks.push(block);
      total += piece.end - piece.start;
    }
    closeCluster();

    return { day: getCalendarDayStr(dayStart), dayStart, total, blocks };
  });
