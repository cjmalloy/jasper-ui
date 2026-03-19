/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { PluginService } from '../../service/api/plugin.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';

import { PluginComponent } from './plugin.component';

describe('PluginComponent', () => {
  let component: PluginComponent;
  let fixture: ComponentFixture<PluginComponent>;
  let admin: any;
  let plugins: any;

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
    plugins = {
      update: vi.fn(() => of(void 0)),
      get: vi.fn((tag: string) => of({
        tag: tag.replace('@local', ''),
        name: 'Test Plugin',
        origin: '@local',
        config: { mod: 'Wiki', version: 1, description: 'edited' },
      })),
    };
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        PluginComponent,
      ],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: PluginService, useValue: plugins },
        { provide: Store, useValue: { account: { origin: '@local' } } },
        { provide: ModService, useValue: { exportHtml: vi.fn(() => ''), setTitle: vi.fn() } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PluginComponent);
    component = fixture.componentInstance;
    component.plugin = {
      tag: 'plugin/test',
      name: 'Test Plugin',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should refresh live admin plugin status after saving an edited versioned plugin', () => {
    admin.status.plugins['plugin/test'] = {
      tag: 'plugin/test',
      name: 'Test Plugin',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    component.editForm.patchValue({
      name: 'Test Plugin',
      config: JSON.stringify({ mod: 'Wiki', version: 1, description: 'edited' }),
    });

    component.save();

    expect(plugins.update).toHaveBeenCalled();
    expect(plugins.get).toHaveBeenCalledWith('plugin/test@local');
    expect(admin.status.plugins['plugin/test']).toEqual(expect.objectContaining({
      tag: 'plugin/test',
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    }));
    expect(admin.status.disabledPlugins['plugin/test']).toBeUndefined();
  });

  it('should move saved disabled plugins into disabled admin status', () => {
    admin.status.plugins['plugin/test'] = {
      tag: 'plugin/test',
      name: 'Test Plugin',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    plugins.get.mockReturnValue(of({
      tag: 'plugin/test',
      name: 'Test Plugin',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, disabled: true },
    }));
    component.editForm.patchValue({
      name: 'Test Plugin',
      config: JSON.stringify({ mod: 'Wiki', version: 1, disabled: true }),
    });

    component.save();

    expect(admin.status.plugins['plugin/test']).toBeUndefined();
    expect(admin.status.disabledPlugins['plugin/test']).toEqual(expect.objectContaining({
      tag: 'plugin/test',
      config: { mod: 'Wiki', version: 1, disabled: true },
    }));
  });
});
