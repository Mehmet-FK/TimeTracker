import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TimeEntryPanelComponent } from './time-entry-panel.component';
import { InlineMarkdownComponent } from '../../../ui/inline-markdown/inline-markdown.component';
import { TimeEntryPanelService, TimeEntryPanelTarget } from '../time-entry-panel.service';
import { TimeEntryService } from '../time-entry.service';
import {
  OpenTimeEntrySession,
  TimeEntryRecorderService,
} from '../time-entry-recorder.service';
import { SnackService } from '../../../core/snack/snack.service';
import { selectTaskEntities } from '../../tasks/store/task.selectors';
import { TagEditComponent } from '../../tag/tag-edit/tag-edit.component';
import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { combineDayAndTime } from '../time-entry.util';

// the real editor needs the whole app; its behaviour is covered by the e2e test
@Component({ selector: 'inline-markdown', standalone: true, template: '' })
class InlineMarkdownStubComponent {
  readonly model = input<string>();
  readonly isShowControls = input<boolean>();
  readonly isShowChecklistToggle = input<boolean>();
  readonly taskId = input<string>();
  readonly placeholderTxt = input<string>();
  readonly changed = output<string>();
}

// the real tag-edit needs the tag and task services; covered by the e2e test
@Component({ selector: 'tag-edit', standalone: true, template: '' })
class TagEditStubComponent {
  readonly tagIds = input.required<string[]>();
  readonly tagUpdate = output<string[]>();
}

const at = (day: string, time: string): number => combineDayAndTime(day, time);

describe('TimeEntryPanelComponent', () => {
  let fixture: ComponentFixture<TimeEntryPanelComponent>;
  let component: TimeEntryPanelComponent;
  let panelService: {
    target: ReturnType<typeof signal<TimeEntryPanelTarget | null>>;
    entryChangedCount: ReturnType<typeof signal<number>>;
    close: jasmine.Spy;
  };
  let timeEntryService: jasmine.SpyObj<TimeEntryService>;
  let recorder: {
    openSession: ReturnType<typeof signal<OpenTimeEntrySession | null>>;
    setOpenSessionFields: jasmine.Spy;
    setOpenSessionTagIds: jasmine.Spy;
    setOpenSessionNote: jasmine.Spy;
  };
  let snackService: jasmine.SpyObj<SnackService>;

  const task: Task = { ...DEFAULT_TASK, id: 't1', title: 'Write report', projectId: '' };
  const entry = {
    id: 'e1',
    start: at('2026-10-10', '09:00'),
    end: at('2026-10-10', '10:00'),
    fields: { ticketNr: 'T-1' },
    tagIds: ['tag-a'],
    note: 'Reviewed the PR',
  };

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    panelService = {
      target: signal<TimeEntryPanelTarget | null>(null),
      entryChangedCount: signal(0),
      close: jasmine.createSpy('close'),
    };
    panelService.close.and.callFake(() => panelService.target.set(null));
    timeEntryService = jasmine.createSpyObj<TimeEntryService>('TimeEntryService', [
      'getTaskWithEntry',
      'updateEntryNote',
      'updateEntryFields',
      'updateEntryTags',
      'updateEntry',
    ]);
    timeEntryService.getTaskWithEntry.and.resolveTo({ task, entry });
    timeEntryService.updateEntryNote.and.resolveTo();
    timeEntryService.updateEntryFields.and.resolveTo();
    timeEntryService.updateEntryTags.and.resolveTo();
    timeEntryService.updateEntry.and.resolveTo();
    recorder = {
      openSession: signal<OpenTimeEntrySession | null>(null),
      setOpenSessionFields: jasmine.createSpy('setOpenSessionFields'),
      setOpenSessionTagIds: jasmine.createSpy('setOpenSessionTagIds'),
      setOpenSessionNote: jasmine.createSpy('setOpenSessionNote'),
    };
    snackService = jasmine.createSpyObj<SnackService>('SnackService', ['open']);

    TestBed.configureTestingModule({
      imports: [TimeEntryPanelComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore({
          selectors: [{ selector: selectTaskEntities, value: { t1: task } }],
        }),
        { provide: TimeEntryPanelService, useValue: panelService },
        { provide: TimeEntryService, useValue: timeEntryService },
        { provide: TimeEntryRecorderService, useValue: recorder },
        { provide: SnackService, useValue: snackService },
      ],
    });
    TestBed.overrideComponent(TimeEntryPanelComponent, {
      remove: { imports: [InlineMarkdownComponent, TagEditComponent] },
      add: { imports: [InlineMarkdownStubComponent, TagEditStubComponent] },
    });
    TestBed.inject(MockStore);
    fixture = TestBed.createComponent(TimeEntryPanelComponent);
    component = fixture.componentInstance;
  });

  describe('for a stored entry', () => {
    beforeEach(async () => {
      panelService.target.set({ taskId: 't1', entryId: 'e1' });
      await settle();
    });

    it('shows the entry with its task, fields, tags and note', () => {
      expect(component.entry()).toEqual({
        taskTitle: 'Write report',
        start: entry.start,
        end: entry.end,
        fields: { ticketNr: 'T-1' },
        tagIds: ['tag-a'],
        note: 'Reviewed the PR',
      });
      expect(component.duration()).toBe(60 * 60 * 1000);
    });

    it('lays out the fields as asked: 2+4, 3+3, 2+2+2, 6', () => {
      const spans = Array.from(
        fixture.nativeElement.querySelectorAll('.grid > *') as NodeListOf<HTMLElement>,
      ).map((el) => {
        const span = Array.from(el.classList).find((c) => c.startsWith('span-'));
        const name =
          el.querySelector('input')?.getAttribute('name') ??
          el.firstElementChild?.localName;
        return `${name}:${span}`;
      });
      expect(spans).toEqual([
        'ticketNr:span-2',
        'task:span-4',
        'date:span-3',
        'requestedBy:span-3',
        'start:span-2',
        'end:span-2',
        'duration:span-2',
        'tag-edit:span-6',
      ]);
    });

    it('saves a field and tells the page', async () => {
      await component.onFieldChange('ticketNr', 'T-2');

      expect(timeEntryService.updateEntryFields).toHaveBeenCalledWith('t1', 'e1', {
        ticketNr: 'T-2',
      });
      expect(panelService.entryChangedCount()).toBe(1);
    });

    it('changes the end time', async () => {
      await component.onEndChange('11:30');

      expect(timeEntryService.updateEntry).toHaveBeenCalledWith(
        't1',
        'e1',
        entry.start,
        at('2026-10-10', '11:30'),
      );
    });

    it('rejects a start after the end', async () => {
      await component.onStartChange('12:00');

      expect(timeEntryService.updateEntry).not.toHaveBeenCalled();
      expect(snackService.open).toHaveBeenCalled();
    });

    it('saves the tags', async () => {
      await component.onTagsChange(['tag-a', 'tag-new']);

      expect(timeEntryService.updateEntryTags).toHaveBeenCalledWith('t1', 'e1', [
        'tag-a',
        'tag-new',
      ]);
      expect(panelService.entryChangedCount()).toBe(1);
    });

    it('saves the note', async () => {
      await component.saveNote('Reviewed the PR\n- [ ] follow up');

      expect(timeEntryService.updateEntryNote).toHaveBeenCalledWith(
        't1',
        'e1',
        'Reviewed the PR\n- [ ] follow up',
      );
    });
  });

  describe('for the running entry', () => {
    beforeEach(async () => {
      recorder.openSession.set({
        taskId: 't1',
        start: entry.start,
        lastSeen: entry.start + 1000,
        fields: { requestedBy: 'Anna' },
        tagIds: ['tag-b'],
        note: 'Started on it',
      });
      panelService.target.set({ isRunning: true });
      await settle();
    });

    it('shows the running entry without an end', () => {
      expect(component.entry()).toEqual(
        jasmine.objectContaining({
          taskTitle: 'Write report',
          end: null,
          fields: { requestedBy: 'Anna' },
          tagIds: ['tag-b'],
          note: 'Started on it',
        }),
      );
      expect(component.duration()).toBe(1000);
    });

    it('stores fields, tags and note with the running entry', async () => {
      await component.onFieldChange('ticketNr', 'T-9');
      await component.onTagsChange(['tag-b', 'tag-a']);
      await component.saveNote('Half done');

      expect(recorder.setOpenSessionFields).toHaveBeenCalledWith({ ticketNr: 'T-9' });
      expect(recorder.setOpenSessionTagIds).toHaveBeenCalledWith(['tag-b', 'tag-a']);
      expect(recorder.setOpenSessionNote).toHaveBeenCalledWith('Half done');
      expect(timeEntryService.updateEntryFields).not.toHaveBeenCalled();
      expect(timeEntryService.updateEntryTags).not.toHaveBeenCalled();
    });

    it('does not change date or times of the running entry', async () => {
      await component.onStartChange('08:00');

      expect(timeEntryService.updateEntry).not.toHaveBeenCalled();
    });

    it('closes once tracking stops', async () => {
      recorder.openSession.set(null);
      await settle();

      expect(panelService.close).toHaveBeenCalled();
    });
  });
});
