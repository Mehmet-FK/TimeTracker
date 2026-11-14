import { T } from '../../t.const';

// Only labels reachable from a current countUp() caller: issue.service -> 'POLL'.
// Anything else falls back to T.GPB.UNKNOWN in GlobalProgressBarService.
export const PROGRESS_BAR_LABEL_MAP: { [key: string]: string } = {
  POLL: T.F.ISSUE.S.POLLING_CHANGES,
};
