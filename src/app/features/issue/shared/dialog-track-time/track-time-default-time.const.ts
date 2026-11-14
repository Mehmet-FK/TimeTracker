import { T } from '../../../../t.const';

/** Which time the track-time dialog fills in by default. Values are persisted. */
export enum TrackTimeDefaultTime {
  AllTime = 'AllTime',
  TimeToday = 'TimeToday',
  TimeYesterday = 'TimeYesterday',
  AllTimeMinusLogged = 'AllTimeMinusLogged',
}

export const TRACK_TIME_DEFAULT_TIME_FORM_OPTIONS: {
  label: string;
  value: TrackTimeDefaultTime;
}[] = [
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.DEFAULT_ALL_TIME,
    value: TrackTimeDefaultTime.AllTime,
  },
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.DEFAULT_ALL_TIME_MINUS_LOGGED,
    value: TrackTimeDefaultTime.AllTimeMinusLogged,
  },
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.DEFAULT_TODAY,
    value: TrackTimeDefaultTime.TimeToday,
  },
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.DEFAULT_YESTERDAY,
    value: TrackTimeDefaultTime.TimeYesterday,
  },
];

export const TRACK_TIME_DEFAULT_TIME_CHECKBOXES: {
  label: string;
  value: TrackTimeDefaultTime;
}[] = [
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.CHECKBOXES.ALL_TIME,
    value: TrackTimeDefaultTime.AllTime,
  },
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.CHECKBOXES.ALL_TIME_MINUS_LOGGED,
    value: TrackTimeDefaultTime.AllTimeMinusLogged,
  },
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.CHECKBOXES.TIME_SPENT_TODAY,
    value: TrackTimeDefaultTime.TimeToday,
  },
  {
    label: T.F.ISSUE.DIALOG_TRACK_TIME.CHECKBOXES.TIME_SPENT_YESTERDAY,
    value: TrackTimeDefaultTime.TimeYesterday,
  },
];
