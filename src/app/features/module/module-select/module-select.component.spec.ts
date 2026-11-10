import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { ModuleSelectComponent } from './module-select.component';
import { ModuleService } from '../module.service';
import { GENERAL_MODULE, GENERAL_MODULE_ID } from '../module.const';
import { Module } from '../module.model';

describe('ModuleSelectComponent', () => {
  let fixture: ComponentFixture<ModuleSelectComponent>;
  let component: ModuleSelectComponent;

  beforeEach(async () => {
    const modules = signal<Module[]>([GENERAL_MODULE, { id: 'm1', name: 'One' }]);
    await TestBed.configureTestingModule({
      imports: [ModuleSelectComponent, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [{ provide: ModuleService, useValue: { modules } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ModuleSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows GENERAL as the default when no module is set', () => {
    expect(component.displayedIds()).toEqual([GENERAL_MODULE_ID]);
    fixture.componentRef.setInput('moduleIds', undefined);
    expect(component.displayedIds()).toEqual([GENERAL_MODULE_ID]);
  });

  it('shows the assigned modules', () => {
    fixture.componentRef.setInput('moduleIds', ['m1', GENERAL_MODULE_ID]);
    expect(component.displayedIds()).toEqual(['m1', GENERAL_MODULE_ID]);
  });

  it('emits the selected moduleIds', () => {
    const emitted: string[][] = [];
    component.moduleIdsChange.subscribe((ids) => emitted.push(ids));
    component.onChange(['m1', GENERAL_MODULE_ID]);
    expect(emitted).toEqual([['m1', GENERAL_MODULE_ID]]);
  });
});
