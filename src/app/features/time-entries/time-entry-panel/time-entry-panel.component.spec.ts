import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TimeEntryPanelComponent } from './time-entry-panel.component';
import { InlineMarkdownComponent } from '../../../ui/inline-markdown/inline-markdown.component';
import { TimeEntryPanelService, TimeEntryPanelTarget } from '../time-entry-panel.service';
import { TimeEntryService } from '../time-entry.service';
import {
  OpenTimeEntrySession,
  TimeEntryRecorderService,
} from '../time-entry-recorder.service';

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

describe('TimeEntryPanelComponent', () => {
  let fixture: ComponentFixture<TimeEntryPanelComponent>;
  let component: TimeEntryPanelComponent;
  let panelService: {
    target: ReturnType<typeof signal<TimeEntryPanelTarget | null>>;
    noteSavedCount: ReturnType<typeof signal<number>>;
    close: jasmine.Spy;
  };
  let timeEntryService: jasmine.SpyObj<TimeEntryService>;
  let recorder: {
    openSession: ReturnType<typeof signal<OpenTimeEntrySession | null>>;
    setOpenSessionNote: jasmine.Spy;
  };

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    panelService = {
      target: signal<TimeEntryPanelTarget | null>(null),
      noteSavedCount: signal(0),
      close: jasmine.createSpy('close'),
    };
    panelService.close.and.callFake(() => panelService.target.set(null));
    timeEntryService = jasmine.createSpyObj<TimeEntryService>('TimeEntryService', [
      'getEntry',
      'updateEntryNote',
    ]);
    timeEntryService.getEntry.and.resolveTo({
      id: 'e1',
      start: 0,
      end: 1000,
      note: 'Reviewed the PR',
    });
    timeEntryService.updateEntryNote.and.resolveTo();
    recorder = {
      openSession: signal<OpenTimeEntrySession | null>(null),
      setOpenSessionNote: jasmine.createSpy('setOpenSessionNote'),
    };

    TestBed.configureTestingModule({
      imports: [TimeEntryPanelComponent, TranslateModule.forRoot()],
      providers: [
        { provide: TimeEntryPanelService, useValue: panelService },
        { provide: TimeEntryService, useValue: timeEntryService },
        { provide: TimeEntryRecorderService, useValue: recorder },
      ],
    });
    TestBed.overrideComponent(TimeEntryPanelComponent, {
      remove: { imports: [InlineMarkdownComponent] },
      add: { imports: [InlineMarkdownStubComponent] },
    });
    fixture = TestBed.createComponent(TimeEntryPanelComponent);
    component = fixture.componentInstance;
  });

  describe('for a stored entry', () => {
    beforeEach(async () => {
      panelService.target.set({ taskId: 't1', entryId: 'e1' });
      await settle();
    });

    it('loads the note of the entry', () => {
      expect(timeEntryService.getEntry).toHaveBeenCalledWith('t1', 'e1');
      expect(component.note()).toBe('Reviewed the PR');
      expect(component.taskId()).toBe('t1');
    });

    it('saves the note and tells the page', async () => {
      await component.save('Reviewed the PR\n- [ ] follow up');

      expect(timeEntryService.updateEntryNote).toHaveBeenCalledWith(
        't1',
        'e1',
        'Reviewed the PR\n- [ ] follow up',
      );
      expect(panelService.noteSavedCount()).toBe(1);
    });
  });

  describe('for the running entry', () => {
    beforeEach(async () => {
      recorder.openSession.set({
        taskId: 't1',
        start: 0,
        lastSeen: 1000,
        note: 'Started on it',
      });
      panelService.target.set({ isRunning: true });
      await settle();
    });

    it('shows and saves the note of the running entry', async () => {
      expect(component.note()).toBe('Started on it');

      await component.save('Started on it, half done');

      expect(recorder.setOpenSessionNote).toHaveBeenCalledWith(
        'Started on it, half done',
      );
      expect(timeEntryService.updateEntryNote).not.toHaveBeenCalled();
    });

    it('closes once tracking stops', async () => {
      recorder.openSession.set(null);
      await settle();

      expect(panelService.close).toHaveBeenCalled();
    });
  });
});
