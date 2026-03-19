/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { Store } from '../../store/store';

import { TemplateComponent } from './template.component';

describe('TemplateComponent', () => {
  let component: TemplateComponent;
  let fixture: ComponentFixture<TemplateComponent>;
  let admin: any;
  let templates: any;

  beforeEach(async () => {
    admin = {
      status: {
        plugins: {},
        disabledPlugins: {},
        templates: {},
        disabledTemplates: {},
      },
      getPlugin: vi.fn(),
    };
    templates = {
      update: vi.fn(() => of(void 0)),
      get: vi.fn((tag: string) => of({
        tag: tag.replace('@local', ''),
        name: 'Test Template',
        origin: '@local',
        config: { mod: 'Wiki', version: 1, description: 'edited' },
      })),
    };
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        TemplateComponent,
      ],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: TemplateService, useValue: templates },
        { provide: Store, useValue: { account: { origin: '@local' } } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateComponent);
    component = fixture.componentInstance;
    component.template = {
      tag: 'config/test',
      name: 'Test Template',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should refresh live admin template status after saving an edited versioned template', () => {
    admin.status.templates['config/test'] = {
      tag: 'config/test',
      name: 'Test Template',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    component.editForm.patchValue({
      name: 'Test Template',
      config: JSON.stringify({ mod: 'Wiki', version: 1, description: 'edited' }),
    });

    component.save();

    expect(templates.update).toHaveBeenCalled();
    expect(templates.get).toHaveBeenCalledWith('config/test@local');
    expect(admin.status.templates['config/test']).toEqual(expect.objectContaining({
      tag: 'config/test',
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    }));
    expect(admin.status.disabledTemplates['config/test']).toBeUndefined();
  });

  it('should move saved disabled templates into disabled admin status', () => {
    admin.status.templates['config/test'] = {
      tag: 'config/test',
      name: 'Test Template',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    templates.get.mockReturnValue(of({
      tag: 'config/test',
      name: 'Test Template',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, disabled: true },
    }));
    component.editForm.patchValue({
      name: 'Test Template',
      config: JSON.stringify({ mod: 'Wiki', version: 1, disabled: true }),
    });

    component.save();

    expect(admin.status.templates['config/test']).toBeUndefined();
    expect(admin.status.disabledTemplates['config/test']).toEqual(expect.objectContaining({
      tag: 'config/test',
      config: { mod: 'Wiki', version: 1, disabled: true },
    }));
  });
});
