import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { distinctUntilChanged, first } from 'rxjs/operators';
import { selectCurrentTaskId, selectTaskEntities } from '../tasks/store/task.selectors';
import { selectIdleTime, selectIsIdle } from '../idle/store/idle.selectors';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { TimeEntryService } from './time-entry.service';
import { getInheritedFieldValues, normalizeFieldValues } from './time-entry.util';
import { Log } from '../../core/log';
import { LS } from '../../core/persistence/storage-keys.const';

export interface OpenTimeEntrySession {
  taskId: string;
  start: number;
  /** Last time tracking was seen running; used to close a session after a crash. */
  lastSeen: number;
  /** Custom field values the entry is stored with. */
  fields?: Record<string, string>;
}

const PERSIST_INTERVAL_MS = 10 * 1000;
/** Shorter sessions (e.g. an accidental start/stop) are not stored as entries. */
export const MIN_TIME_ENTRY_DURATION_MS = 1000;

/**
 * Turns live tracking into time entries: starting to track a task opens a
 * session, stopping or switching closes it and stores it on the task.
 *
 * The open session is mirrored to localStorage, so a session interrupted by
 * closing or crashing the app is stored on the next start, ending at the last
 * moment tracking was seen running.
 */
@Injectable({
  providedIn: 'root',
})
export class TimeEntryRecorderService {
  private readonly _store = inject(Store);
  private readonly _timeEntryService = inject(TimeEntryService);
  private readonly _trackingIntervalService = inject(GlobalTrackingIntervalService);
  private readonly _dataInitStateService = inject(DataInitStateService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _taskEntities = this._store.selectSignal(selectTaskEntities);
  private readonly _isIdle = this._store.selectSignal(selectIsIdle);
  private readonly _idleTime = this._store.selectSignal(selectIdleTime);

  readonly openSession = signal<OpenTimeEntrySession | null>(null);
  private _lastPersistedAt = 0;
  private _isInitialized = false;

  init(): void {
    if (this._isInitialized) {
      return;
    }
    this._isInitialized = true;

    this._dataInitStateService.isAllDataLoadedInitially$
      .pipe(first(), takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._storeInterruptedSession();

        this._store
          .select(selectCurrentTaskId)
          .pipe(distinctUntilChanged(), takeUntilDestroyed(this._destroyRef))
          .subscribe((taskId) => this._onCurrentTaskChange(taskId));

        this._trackingIntervalService.tick$
          .pipe(takeUntilDestroyed(this._destroyRef))
          .subscribe(() => this._onTick());
      });
  }

  private _onCurrentTaskChange(taskId: string | null): void {
    const now = Date.now();
    const session = this.openSession();
    if (session && session.taskId !== taskId) {
      // idle handling stops tracking and removes the idle time from the task,
      // so the entry ends when the user became idle
      const end = this._isIdle() ? Math.max(session.start, now - this._idleTime()) : now;
      this._closeSession(session, end);
    }
    if (taskId && session?.taskId !== taskId) {
      const fields = normalizeFieldValues(
        getInheritedFieldValues(this._taskEntities()[taskId]?.timeEntries),
      );
      this._setSession(
        { taskId, start: now, lastSeen: now, ...(fields ? { fields } : {}) },
        true,
      );
    }
  }

  /**
   * Hands the entry that is currently being tracked over to another task,
   * keeping its start and field values. Switch the current task afterwards.
   */
  reassignOpenSession(taskId: string): void {
    const session = this.openSession();
    if (session) {
      this._setSession({ ...session, taskId }, true);
    }
  }

  /** Sets custom field values of the entry that is currently being tracked. */
  setOpenSessionFields(changes: Record<string, string>): void {
    const session = this.openSession();
    if (!session) {
      return;
    }
    const fields = normalizeFieldValues({ ...session.fields, ...changes });
    const { taskId, start, lastSeen } = session;
    this._setSession({ taskId, start, lastSeen, ...(fields ? { fields } : {}) }, true);
  }

  private _onTick(): void {
    const session = this.openSession();
    if (!session) {
      return;
    }
    const now = Date.now();
    this._setSession(
      { ...session, lastSeen: now },
      now - this._lastPersistedAt >= PERSIST_INTERVAL_MS,
    );
  }

  private _closeSession(session: OpenTimeEntrySession, end: number): void {
    this._setSession(null, true);
    if (end - session.start < MIN_TIME_ENTRY_DURATION_MS) {
      return;
    }
    this._timeEntryService
      .addTrackedEntry(session.taskId, session.start, end, session.fields)
      .catch((e) => Log.err('Failed to store time entry', { id: session.taskId }, e));
  }

  private _storeInterruptedSession(): void {
    const session = this._readPersistedSession();
    if (session) {
      this._closeSession(session, session.lastSeen);
    }
  }

  private _setSession(session: OpenTimeEntrySession | null, isPersist: boolean): void {
    this.openSession.set(session);
    if (!isPersist) {
      return;
    }
    this._lastPersistedAt = Date.now();
    try {
      if (session) {
        localStorage.setItem(LS.OPEN_TIME_ENTRY_SESSION, JSON.stringify(session));
      } else {
        localStorage.removeItem(LS.OPEN_TIME_ENTRY_SESSION);
      }
    } catch (e) {
      Log.err('Failed to persist open time entry session', e);
    }
  }

  private _readPersistedSession(): OpenTimeEntrySession | null {
    try {
      const raw = localStorage.getItem(LS.OPEN_TIME_ENTRY_SESSION);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<OpenTimeEntrySession>;
      if (
        typeof parsed.taskId === 'string' &&
        typeof parsed.start === 'number' &&
        typeof parsed.lastSeen === 'number'
      ) {
        const fields =
          parsed.fields && typeof parsed.fields === 'object'
            ? normalizeFieldValues(
                Object.fromEntries(
                  Object.entries(parsed.fields).filter(([, v]) => typeof v === 'string'),
                ),
              )
            : undefined;
        return {
          taskId: parsed.taskId,
          start: parsed.start,
          lastSeen: parsed.lastSeen,
          ...(fields ? { fields } : {}),
        };
      }
    } catch (e) {
      Log.err('Failed to read open time entry session', e);
    }
    return null;
  }
}
