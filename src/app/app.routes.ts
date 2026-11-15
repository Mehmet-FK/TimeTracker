import { Routes } from '@angular/router';

import {
  ActiveWorkContextGuard,
  DefaultStartPageGuard,
  DonatePageGuard,
  ValidProjectIdGuard,
  ValidTagIdGuard,
} from './app.guard';

import { TagTaskPageComponent } from './pages/tag-task-page/tag-task-page.component';

export const APP_ROUTES: Routes = [
  // Eagerly loaded — this is the main view
  {
    path: 'tag/:id/tasks',
    component: TagTaskPageComponent,
    data: { page: 'tag-tasks' },
    canActivate: [ValidTagIdGuard],
  },
  // Tag sub-routes (worklog, history, summary, metrics)
  // Must appear after tag/:id/tasks so the more specific path matches first
  {
    path: 'tag/:id',
    canActivate: [ValidTagIdGuard],    loadChildren: () => import('./routes/context.routes').then((m) => m.TAG_CHILD_ROUTES),
  },
  // Project routes (tasks, worklog, history, summary, metrics)
  // Shares one chunk with tag routes via context.routes.ts
  {
    path: 'project/:id',
    canActivate: [ValidProjectIdGuard],    loadChildren: () =>
      import('./routes/context.routes').then((m) => m.PROJECT_CHILD_ROUTES),
  },
  // Standalone pages — all import from same barrel so they share one chunk
  {
    path: 'config',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ConfigPageComponent),
    data: { page: 'config' },  },
  {
    path: 'search',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.SearchPageComponent),
    data: { page: 'search' },  },
  {
    path: 'scheduled-list',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ScheduledListPageComponent),
    data: { page: 'scheduled-list' },  },
  {
    path: 'planner',
    loadComponent: () => import('./routes/pages.routes').then((m) => m.PlannerComponent),
    data: { page: 'planner' },  },
  {
    path: 'schedule',
    loadComponent: () => import('./routes/pages.routes').then((m) => m.ScheduleComponent),
    data: { page: 'schedule' },  },
  {
    path: 'boards',
    loadComponent: () => import('./routes/pages.routes').then((m) => m.BoardsComponent),
    data: { page: 'boards' },  },
  {
    path: 'habits',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.HabitPageComponent),
    data: { page: 'habits' },  },
  {
    path: 'time-entries',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.TimeEntriesPageComponent),
    data: { page: 'time-entries' },  },
  {
    path: 'modules',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ModulesPageComponent),
    data: { page: 'modules' },  },
  {
    path: 'archived-projects',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ArchivedProjectsPageComponent),
    data: { page: 'archived-projects' },  },
  {
    path: 'donate',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.DonatePageComponent),
    data: { page: 'donate' },
    canActivate: [DonatePageGuard],
  },
  {
    path: 'contrast-test',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ContrastTestComponent),
    data: { page: 'contrast-test' },
  },
  {
    path: 'plugins/:pluginId/index',
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.PluginIndexComponent),
    data: { page: 'plugin-index' },  },
  {
    path: 'active/:subPageType',
    canActivate: [ActiveWorkContextGuard],
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ConfigPageComponent),
  },
  {
    path: 'active/:subPageType/:param',
    canActivate: [ActiveWorkContextGuard],
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ConfigPageComponent),
  },
  {
    path: 'active',
    canActivate: [ActiveWorkContextGuard],
    loadComponent: () =>
      import('./routes/pages.routes').then((m) => m.ConfigPageComponent),
  },
  // Wildcard — redirects to default start page
  {
    path: '**',
    canActivate: [DefaultStartPageGuard],
    component: TagTaskPageComponent,
  },
];
