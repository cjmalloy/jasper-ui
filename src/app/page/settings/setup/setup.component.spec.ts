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
                installMod$() { return of(null); },
                getUnmetPeerDependencies(bundle?: Mod) {
                  return {
                    available: [],
                    unavailable: [
                      ...bundle?.plugin?.flatMap(plugin => plugin.config?.peerDependencies || []) || [],
                      ...bundle?.template?.flatMap(template => template.config?.peerDependencies || []) || [],
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
    component.unmetDependencies = ['Community Tools & More'];
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.store-dependency-link');
    expect(link.textContent).toContain('Community Tools & More');
    expect(new URL(link.href).searchParams.get('search')).toBe('Community Tools & More');
  });

  it('should install peer dependencies from setup', () => {
    const target: Plugin = {
      tag: 'plugin/community',
      config: { mod: 'Community' },
    };
    const targetBundle: Mod = {
      plugin: [target],
    };
    const available: Mod = {
      plugin: [{ tag: 'plugin/available', config: { mod: 'Available' } }],
    };
    const admin = TestBed.inject(AdminService);
    admin.def.plugins[target.tag] = target;
    vi.spyOn(admin, 'getMod').mockImplementation(mod => mod === 'Community' ? targetBundle : available);
    vi.spyOn(admin, 'getUnmetPeerDependencies').mockReturnValue({
      available: [['Available', available]],
      unavailable: ['Missing'],
    });
    const install = vi.spyOn(admin, 'installMod$').mockReturnValue(of(null));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.adminForm = new UntypedFormGroup({
      mods: new UntypedFormGroup({
        [target.tag]: new UntypedFormControl(true),
      }),
    });

    component.install();

    expect(window.confirm).toHaveBeenCalledWith('Install peer dependencies?');
    expect(install.mock.calls.map(([mod]) => mod)).toEqual(['Available', 'Community']);
    expect(component.unmetDependencies).toEqual(['Missing']);
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
            config: { peerDependencies: ['Missing'] },
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
