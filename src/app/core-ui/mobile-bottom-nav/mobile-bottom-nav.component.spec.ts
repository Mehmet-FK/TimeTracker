import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter, RouterLink, RouterLinkActive } from '@angular/router';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { MobileBottomNavComponent } from './mobile-bottom-nav.component';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { StartNewTaskService } from '../../features/tasks/start-new-task.service';

/**
 * The phone bottom bar holds exactly Time Entries, the start-tracking FAB and
 * Menu, in that order. Everything else (Today, Planner, the side-panel
 * toggles) lives in the Menu; `magic-nav-config.service.spec` pins that side.
 */
describe('MobileBottomNavComponent', () => {
  let fixture: ComponentFixture<MobileBottomNavComponent>;
  let startNewTaskService: jasmine.SpyObj<StartNewTaskService>;

  beforeEach(async () => {
    startNewTaskService = jasmine.createSpyObj<StartNewTaskService>(
      'StartNewTaskService',
      ['toggleStartNewTask'],
    );

    await TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        NoopAnimationsModule,
        MobileBottomNavComponent,
      ],
      providers: [
        provideRouter([]),
        {
          provide: WorkContextService,
          useValue: { activeWorkContext$: of({ isEnableBacklog: false }) },
        },
        { provide: StartNewTaskService, useValue: startNewTaskService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileBottomNavComponent);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  const navEl = (): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector('nav') as HTMLElement;
  const buttons = (): HTMLButtonElement[] =>
    Array.from(navEl().querySelectorAll('button'));
  /** Elements carrying a routerLink, keyed by the URL they link to. */
  const routerLinks = (): Map<string, HTMLElement> =>
    new Map(
      fixture.debugElement
        .queryAll(By.directive(RouterLink))
        .map((de) => [
          de.injector.get(RouterLink).urlTree?.toString() ?? '',
          de.nativeElement as HTMLElement,
        ]),
    );

  it('renders exactly Time Entries, + and Menu, in that order', () => {
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'MH.TIME_ENTRIES',
      'MH.START_NEW_TASK',
      'MH.PROJECT_MENU',
    ]);
    expect(buttons()[1].classList).toContain('add-task-button');
  });

  it('has no Today, Planner or side-panel menu button', () => {
    expect(routerLinks().has('/tag/TODAY/tasks')).toBe(false);
    expect(routerLinks().has('/planner')).toBe(false);
    expect(navEl().textContent).not.toContain('wb_sunny');
    expect(navEl().textContent).not.toContain('edit_calendar');
    expect(navEl().querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it('links Time Entries to /time-entries with an active state', () => {
    const timeEntries = routerLinks().get('/time-entries');

    expect(timeEntries).toBe(buttons()[0]);
    expect(
      fixture.debugElement
        .queryAll(By.directive(RouterLinkActive))
        .some((de) => de.nativeElement === timeEntries),
    ).toBe(true);
  });

  it('starts a new time entry on +', () => {
    buttons()[1].click();

    expect(startNewTaskService.toggleStartNewTask).toHaveBeenCalledTimes(1);
  });

  it('emits toggleMobileNavEvent on Menu', () => {
    const spy = jasmine.createSpy('toggleMobileNav');
    fixture.componentInstance.toggleMobileNavEvent.subscribe(spy);

    buttons()[2].click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps the onboarding hint selector pointing at the Menu button', () => {
    // onboarding-hint.component targets `mobile-bottom-nav nav > button:last-of-type`.
    expect(navEl().querySelector(':scope > button:last-of-type')).toBe(buttons()[2]);
  });
});
