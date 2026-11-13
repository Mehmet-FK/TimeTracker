import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MagicNavConfigService } from './magic-nav-config.service';
import { NavActionItem, NavItem } from './magic-side-nav.model';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { TagService } from '../../features/tag/tag.service';
import { ShepherdService } from '../../features/shepherd/shepherd.service';
import { PluginBridgeService } from '../../plugins/plugin-bridge.service';
import { PluginService } from '../../plugins/plugin.service';
import { MenuTreeService } from '../../features/menu-tree/menu-tree.service';
import { GlobalConfigService } from '../../features/config/global-config.service';
import { SnackService } from '../../core/snack/snack.service';
import { LayoutService } from '../layout/layout.service';
import { DEFAULT_GLOBAL_CONFIG } from '../../features/config/default-global-config.const';
import { AppFeaturesConfig } from '../../features/config/global-config.model';
import { togglePluginPanel } from '../layout/store/layout.actions';
import { T } from '../../t.const';

/**
 * Below 600px the header renders no panel buttons and the bottom nav only holds
 * Time Entries, + and Menu, so the Menu (this config) is the only route to the
 * right-panel toggles on a phone. These pin that every enabled panel and every
 * plugin side-panel button is listed there, and that desktop is untouched.
 */
describe('MagicNavConfigService mobile panel entries', () => {
  interface SidePanelBtn {
    pluginId: string;
    label: string;
    icon?: string;
    onClick: () => void;
  }

  const PANEL_IDS: ReadonlyArray<[keyof AppFeaturesConfig, string]> = [
    ['isScheduleDayPanelEnabled', 'panel-schedule-day'],
    ['isIssuesPanelEnabled', 'panel-issues'],
    ['isProjectNotesEnabled', 'panel-notes'],
  ];

  let appFeatures: WritableSignal<AppFeaturesConfig>;
  let isMobile: WritableSignal<boolean>;
  let sidePanelButtons: WritableSignal<SidePanelBtn[]>;
  let layoutService: jasmine.SpyObj<
    Pick<LayoutService, 'toggleScheduleDayPanel' | 'toggleAddTaskPanel' | 'toggleNotes'>
  >;
  let store: { select: jasmine.Spy; dispatch: jasmine.Spy };

  const setup = (
    over: Partial<AppFeaturesConfig>,
    mobile = true,
    buttons: SidePanelBtn[] = [],
  ): MagicNavConfigService => {
    appFeatures = signal({ ...DEFAULT_GLOBAL_CONFIG.appFeatures, ...over });
    isMobile = signal(mobile);
    sidePanelButtons = signal(buttons);
    layoutService = jasmine.createSpyObj('LayoutService', [
      'toggleScheduleDayPanel',
      'toggleAddTaskPanel',
      'toggleNotes',
    ]);
    store = {
      select: jasmine.createSpy('select').and.returnValue(of([])),
      dispatch: jasmine.createSpy('dispatch'),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MagicNavConfigService,
        {
          provide: WorkContextService,
          useValue: {
            mainWorkContext$: of({ id: 'TODAY', title: 'Today', taskIds: [] }),
            inboxWorkContext$: of(null),
          },
        },
        { provide: TagService, useValue: { tagsNoMyDayAndNoList$: of([]) } },
        { provide: ShepherdService, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: Store, useValue: store },
        {
          provide: PluginBridgeService,
          useValue: { menuEntries: signal([]), sidePanelButtons },
        },
        {
          provide: PluginService,
          useValue: {
            getAllPluginStates: () => new Map(),
            getPluginIconsSignal: () => signal(new Map()),
          },
        },
        {
          provide: MenuTreeService,
          useValue: {
            buildProjectViewTree: () => [],
            buildTagViewTree: () => [],
            hasProjectTree: () => true,
            hasTagTree: () => true,
          },
        },
        { provide: GlobalConfigService, useValue: { appFeatures } },
        { provide: SnackService, useValue: {} },
        { provide: Router, useValue: {} },
        {
          provide: LayoutService,
          useValue: { ...layoutService, isShowMobileBottomNav: isMobile },
        },
      ],
    });
    return TestBed.inject(MagicNavConfigService);
  };

  const panelItems = (svc: MagicNavConfigService): NavItem[] =>
    svc.navConfig().items.filter((i) => i.id.startsWith('panel-'));

  const cases: Array<[string, Partial<AppFeaturesConfig>]> = [
    ['all three enabled', {}],
    ['only schedule', { isIssuesPanelEnabled: false, isProjectNotesEnabled: false }],
    ['only issues', { isScheduleDayPanelEnabled: false, isProjectNotesEnabled: false }],
    ['only notes', { isScheduleDayPanelEnabled: false, isIssuesPanelEnabled: false }],
    [
      'none',
      {
        isScheduleDayPanelEnabled: false,
        isIssuesPanelEnabled: false,
        isProjectNotesEnabled: false,
      },
    ],
  ];

  cases.forEach(([name, over]) => {
    it(`lists every enabled panel on mobile — ${name}`, () => {
      const svc = setup(over);
      const af = { ...DEFAULT_GLOBAL_CONFIG.appFeatures, ...over };

      expect(panelItems(svc).map((i) => i.id)).toEqual(
        PANEL_IDS.filter(([flag]) => af[flag]).map(([, id]) => id),
      );
    });
  });

  it('adds no panel entries on desktop', () => {
    const svc = setup({}, false, [
      { pluginId: 'p1', label: 'Doc Mode', icon: 'description', onClick: () => {} },
    ]);

    expect(panelItems(svc)).toEqual([]);
  });

  it('follows the breakpoint when it changes', () => {
    const svc = setup({}, false);
    expect(panelItems(svc).length).toBe(0);

    isMobile.set(true);

    expect(panelItems(svc).length).toBe(3);
  });

  it('wires each panel entry to its layout toggle', () => {
    const svc = setup({});
    const byId = new Map(panelItems(svc).map((i) => [i.id, i as NavActionItem]));

    expect(byId.get('panel-schedule-day')?.label).toBe(T.BN.SHOW_SCHEDULE);
    byId.get('panel-schedule-day')?.action();
    expect(layoutService.toggleScheduleDayPanel).toHaveBeenCalledTimes(1);

    expect(byId.get('panel-issues')?.label).toBe(T.BN.SHOW_ISSUE_PANEL);
    byId.get('panel-issues')?.action();
    expect(layoutService.toggleAddTaskPanel).toHaveBeenCalledTimes(1);

    expect(byId.get('panel-notes')?.label).toBe(T.BN.SHOW_NOTES);
    byId.get('panel-notes')?.action();
    expect(layoutService.toggleNotes).toHaveBeenCalledTimes(1);
  });

  it('lists plugin side-panel buttons on mobile even with every built-in off', () => {
    const onClick = jasmine.createSpy('onClick');
    const svc = setup(
      {
        isScheduleDayPanelEnabled: false,
        isIssuesPanelEnabled: false,
        isProjectNotesEnabled: false,
      },
      true,
      [{ pluginId: 'p1', label: 'Doc Mode', onClick }],
    );

    const items = panelItems(svc) as NavActionItem[];
    expect(items.map((i) => [i.id, i.label, i.icon])).toEqual([
      ['panel-plugin-p1', 'Doc Mode', 'extension'],
    ]);

    items[0].action();

    expect(store.dispatch).toHaveBeenCalledWith(togglePluginPanel('p1'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the pages removed from the bottom nav in the menu', () => {
    const svc = setup({});
    const ids = svc.navConfig().items.map((i) => i.id);

    for (const id of [
      'main-TODAY',
      'planner',
      'schedule',
      'boards',
      'habits',
      'time-entries',
      'modules',
      'search',
      'scheduled-list',
      'settings',
    ]) {
      expect(ids).toContain(id);
    }
  });
});
