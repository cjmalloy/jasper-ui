/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Plugin } from '../../../model/plugin';
import { Mod } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { Store } from '../../../store/store';

import { SettingsSetupPage } from './setup.component';

describe('SettingsSetupPage', () => {
  let component: SettingsSetupPage;
  let fixture: ComponentFixture<SettingsSetupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SettingsSetupPage,
      ],
      providers: [
        {
          provide: AdminService,
          useValue: {
                init$: of(null),
                getPlugin() { },
                getTemplate() { },
                getMod() { },
                getUnmetPeerDependencies(bundle?: Mod) {
                  return {
                    available: [],
                    unavailable: [
                      ...bundle?.plugin?.flatMap(plugin => plugin.peerDependencies || []) || [],
                      ...bundle?.template?.flatMap(template => template.peerDependencies || []) || [],
                    ],
                  };
                },
                def: { plugins: {}, templates: {} },
                status: {
                  plugins: {},
                  disabledPlugins: {},
                  templates: {},
                  disabledTemplates: {},
                  receipts: {},
                }
            }
        },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsSetupPage);
    component = fixture.componentInstance;
    component.adminForm = new UntypedFormGroup({
      mods: new UntypedFormGroup({
        root: new UntypedFormControl(),
      }),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show unmet dependency warnings in setup logs', () => {
    const admin = TestBed.inject(AdminService);
    vi.spyOn(admin, 'getPlugin').mockReturnValue({ tag: 'plugin/mod/store' });
    const store = TestBed.inject(Store);
    store.eventBus.unmetDependency('Community Tools & More');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.store-dependency-link');
    expect(link.textContent).toContain('Community Tools & More');
    expect(new URL(link.href).searchParams.get('search')).toBe('Community Tools & More');
  });

  it('should mark installed mods with unmet peer dependencies', () => {
    const config: Plugin = {
      tag: 'plugin/community',
      config: { mod: 'Community' },
    };
    const admin = TestBed.inject(AdminService);
    admin.status.plugins[config.tag] = config;
    admin.status.receipts['Community'] = {
      url: 'mod-receipt:Community',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: config.tag,
            peerDependencies: ['Missing'],
          }],
        },
      },
    };
    component.modGroups = { feature: [['plugin/community', config]] } as typeof component.modGroups;
    component.adminForm = new UntypedFormGroup({
      mods: new UntypedFormGroup({
        'plugin/community': new UntypedFormControl(true),
      }),
    });
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.peer-dependency-warning');
    expect(warning.getAttribute('title')).toBe('Unmet peer dependencies: Missing');
  });
});
