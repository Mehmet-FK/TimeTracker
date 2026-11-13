import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { T } from '../../t.const';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { IS_ANDROID_NATIVE } from '../../util/is-native-platform';
import { StartNewTaskService } from '../../features/tasks/start-new-task.service';

// Latches true after the first cold-start entrance fires in this JS session,
// so resume/back/remount paths never re-hide the FAB.
let _hasFiredColdStartEntrance = false;

/**
 * Phone bottom bar: exactly Time Entries, the start-tracking FAB and Menu.
 * Everything else (Today, Planner, the side-panel toggles, ...) lives in the
 * Menu, i.e. the magic side nav (see `MagicNavConfigService`).
 */
@Component({
  selector: 'mobile-bottom-nav',
  standalone: true,
  imports: [RouterModule, MatIconModule, MatButtonModule, TranslateModule],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileBottomNavComponent {
  private readonly _workContextService = inject(WorkContextService);
  private readonly _startNewTaskService = inject(StartNewTaskService);

  isEntrance = input(false);
  readonly isAndroid = IS_ANDROID_NATIVE;

  // Tracks whether the slide-up entrance animation is actively running.
  // On Android, the web FAB is hidden only during this animation, and only on
  // a true cold start — remounts from back/resume/focus-mode toggle must not
  // re-trigger the hide.
  readonly isEntranceAnimating = signal(false);
  private _entranceAnimationTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this._entranceAnimationTimeout));

    effect(() => {
      if (!_hasFiredColdStartEntrance && this.isAndroid && this.isEntrance()) {
        _hasFiredColdStartEntrance = true;
        this.isEntranceAnimating.set(true);
        // Safety fallback: clear if animationend doesn't fire
        // (e.g. prefers-reduced-motion: reduce → animation: none).
        // Timeout = 250ms delay + 400ms duration + 50ms buffer = 700ms
        this._entranceAnimationTimeout = setTimeout(() => {
          this.isEntranceAnimating.set(false);
        }, 700);
      }
    });
  }

  onEntranceAnimationEnd(event: AnimationEvent): void {
    if (event.animationName === 'slide-up-from-bottom') {
      this.isEntranceAnimating.set(false);
      clearTimeout(this._entranceAnimationTimeout);
    }
  }

  readonly T = T;

  // Output events
  toggleMobileNavEvent = output<void>();

  readonly hasProjectBacklog = toSignal(
    this._workContextService.activeWorkContext$.pipe(map((ac) => ac.isEnableBacklog)),
  );

  /** Starts a new time entry, or stops the running one. */
  startNewEntry(): void {
    this._startNewTaskService.toggleStartNewTask();
  }

  toggleMobileNav(): void {
    this.toggleMobileNavEvent.emit();
  }
}
