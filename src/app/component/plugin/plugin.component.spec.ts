/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { PluginService } from '../../service/api/plugin.service';

import { PluginComponent } from './plugin.component';

describe('PluginComponent', () => {
  let component: PluginComponent;
  let fixture: ComponentFixture<PluginComponent>;
  let admin: any;
  let plugins: any;

  beforeEach(async () => {
    admin = {
      status: { plugins: {}, disabledPlugins: {} },
      getInstalledPlugin: vi.fn(),
      resetPlugin$: vi.fn(() => of(null)),
      getPlugin: vi.fn(),
    };
    plugins = {
      update: vi.fn(() => of(null)),
      get: vi.fn(() => of({ tag: 'plugin/test', config: { description: 'edited' } })),
      create: vi.fn(() => of(null)),
      delete: vi.fn(() => of(null)),
    };
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        PluginComponent,
      ],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: PluginService, useValue: plugins },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PluginComponent);
    component = fixture.componentInstance;
    component.plugin = { tag: 'plugin/test' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update admin plugin status after save', () => {
    component.plugin = { tag: 'plugin/test', name: 'Plugin', config: { mod: 'Wiki' } };
    component.init();
    component.editForm.patchValue({
      tag: 'plugin/test',
      name: 'Plugin',
      config: JSON.stringify({ mod: 'Wiki', description: 'edited' }),
    });

    component.save();

    expect(admin.status.plugins['plugin/test']).toEqual({ tag: 'plugin/test', config: { description: 'edited' } });
  });
});
