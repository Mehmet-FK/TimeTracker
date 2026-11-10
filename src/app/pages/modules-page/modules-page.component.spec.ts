import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { ModulesPageComponent } from './modules-page.component';
import { ModuleService } from '../../features/module/module.service';
import { GENERAL_MODULE, GENERAL_MODULE_ID } from '../../features/module/module.const';
import { Module } from '../../features/module/module.model';

describe('ModulesPageComponent', () => {
  let fixture: ComponentFixture<ModulesPageComponent>;
  let el: HTMLElement;
  let serviceSpy: jasmine.SpyObj<ModuleService>;

  const setInput = (selector: string, value: string): void => {
    const input = el.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<ModuleService>('ModuleService', [
      'add',
      'update',
      'delete',
    ]);
    const modules = signal<Module[]>([GENERAL_MODULE, { id: 'm1', name: 'One' }]);
    (serviceSpy as any).modules = modules.asReadonly();

    await TestBed.configureTestingModule({
      imports: [ModulesPageComponent, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [{ provide: ModuleService, useValue: serviceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ModulesPageComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const buttonsOf = (id: string): { edit: HTMLButtonElement; del: HTMLButtonElement } => {
    const li = el.querySelector(`[data-module-id="${id}"]`) as HTMLElement;
    return {
      edit: li.querySelector('.module-edit-btn') as HTMLButtonElement,
      del: li.querySelector('.module-delete-btn') as HTMLButtonElement,
    };
  };

  it('disables edit and delete for GENERAL only', () => {
    const general = buttonsOf(GENERAL_MODULE_ID);
    expect(general.edit.disabled).toBeTrue();
    expect(general.del.disabled).toBeTrue();
    const other = buttonsOf('m1');
    expect(other.edit.disabled).toBeFalse();
    expect(other.del.disabled).toBeFalse();
  });

  it('shows GENERAL fields read-only and refuses to save', () => {
    fixture.componentInstance.startEdit(GENERAL_MODULE);
    fixture.detectChanges();
    expect((el.querySelector('.module-name') as HTMLInputElement).readOnly).toBeTrue();
    expect(
      (el.querySelector('.module-description') as HTMLInputElement).readOnly,
    ).toBeTrue();
    expect((el.querySelector('.module-icon-url') as HTMLInputElement).readOnly).toBeTrue();
    expect((el.querySelector('.module-save-btn') as HTMLButtonElement).disabled).toBeTrue();

    fixture.componentInstance.save();
    expect(serviceSpy.update).not.toHaveBeenCalled();
  });

  it('shows an error for an invalid iconUrl and blocks saving', () => {
    fixture.componentInstance.startAdd();
    fixture.detectChanges();
    setInput('.module-name', 'Name');
    setInput('.module-icon-url', 'not a url');

    expect(el.querySelector('.module-icon-url-error')).toBeTruthy();
    expect((el.querySelector('.module-save-btn') as HTMLButtonElement).disabled).toBeTrue();

    setInput('.module-icon-url', 'https://example.com/i.png');
    expect(el.querySelector('.module-icon-url-error')).toBeNull();
    expect(
      (el.querySelector('.module-save-btn') as HTMLButtonElement).disabled,
    ).toBeFalse();
  });

  it('creates a module from the form', () => {
    fixture.componentInstance.startAdd();
    fixture.detectChanges();
    setInput('.module-name', ' Docs ');
    fixture.componentInstance.save();
    expect(serviceSpy.add).toHaveBeenCalledWith({
      name: 'Docs',
      description: undefined,
      iconUrl: undefined,
    });
  });
});
