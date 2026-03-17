/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';

import { TemplateComponent } from './template.component';

describe('TemplateComponent', () => {
  let component: TemplateComponent;
  let fixture: ComponentFixture<TemplateComponent>;
  let admin: any;
  let templates: any;
  const modified = {
    toISO: () => '2024-01-01T00:00:00Z',
    toRelative: () => 'now',
  };

  beforeEach(async () => {
    admin = {
      status: { templates: {}, disabledTemplates: {} },
      getInstalledTemplate: vi.fn(),
      resetTemplate$: vi.fn(() => of(null)),
      getPlugin: vi.fn(),
    };
    templates = {
      update: vi.fn(() => of(null)),
      get: vi.fn(() => of({ tag: 'template', config: { description: 'edited' } })),
      create: vi.fn(() => of(null)),
      delete: vi.fn(() => of(null)),
    };
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        TemplateComponent,
      ],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: TemplateService, useValue: templates },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateComponent);
    component = fixture.componentInstance;
    component.template = { tag: 'template' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update admin template status after save', () => {
    component.template = { tag: 'template', name: 'Template', config: { mod: 'Wiki' } };
    component.init();
    component.editForm.patchValue({
      tag: 'template',
      name: 'Template',
      config: JSON.stringify({ mod: 'Wiki', description: 'edited' }),
    });

    component.save();

    expect(templates.update).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'template',
      name: 'Template',
      config: { mod: 'Wiki', description: 'edited' },
    }));
    expect(admin.status.templates.template).toEqual({ tag: 'template', config: { description: 'edited' } });
  });

  it('should move disabled templates into disabled status after save', () => {
    templates.get.mockReturnValueOnce(of({ tag: 'template', config: { disabled: true, description: 'edited' } }));
    component.template = { tag: 'template', name: 'Template', config: { mod: 'Wiki' } };
    component.init();
    component.editForm.patchValue({
      tag: 'template',
      name: 'Template',
      config: JSON.stringify({ mod: 'Wiki', disabled: true, description: 'edited' }),
    });

    component.save();

    expect(admin.status.templates.template).toBeUndefined();
    expect(admin.status.disabledTemplates.template).toEqual({
      tag: 'template',
      config: { disabled: true, description: 'edited' }
    });
  });

  it('should hide reset when the local template matches the installed version', () => {
    component.store.account.admin = true;
    admin.getInstalledTemplate.mockReturnValue({
      tag: 'template',
      config: { mod: 'Wiki', version: 1, description: 'same' },
    });
    fixture.componentRef.setInput('template', {
      tag: 'template',
      origin: component.store.account.origin,
      modified,
      config: { mod: 'Wiki', version: 1, description: 'same' },
    });

    fixture.detectChanges();

    expect(component.canReset).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('reset');
  });

  it('should confirm before resetting a changed local template', () => {
    component.store.account.admin = true;
    admin.getInstalledTemplate.mockReturnValue({
      tag: 'template',
      config: { mod: 'Wiki', version: 1 },
    });
    fixture.componentRef.setInput('template', {
      tag: 'template',
      origin: component.store.account.origin,
      modified,
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    });

    fixture.detectChanges();

    const reset = [...fixture.nativeElement.querySelectorAll('.actions .fake-link')]
      .find((element: HTMLElement) => element.textContent?.trim() === 'reset') as HTMLElement;
    expect(reset).toBeTruthy();

    reset.click();
    fixture.detectChanges();

    expect(admin.resetTemplate$).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('are you sure?');

    const yes = [...fixture.nativeElement.querySelectorAll('.actions .fake-link')]
      .find((element: HTMLElement) => element.textContent?.trim() === 'yes') as HTMLElement;
    yes.click();

    expect(admin.resetTemplate$).toHaveBeenCalledTimes(1);
    expect(admin.resetTemplate$.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      tag: 'template',
      config: expect.objectContaining({ description: 'edited' }),
    }));
    expect(admin.resetTemplate$.mock.calls[0]?.[1]).toEqual(expect.any(Function));
  });
});
