/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor';
import { of } from 'rxjs';
import { AdminService } from '../../../service/admin.service';
import { modId } from '../../../util/format';

import { SettingsSetupPage } from './setup.component';

describe('SettingsSetupPage', () => {
  let component: SettingsSetupPage;
  let fixture: ComponentFixture<SettingsSetupPage>;
  let overlayContainer: OverlayContainer;
  let overlayContainerElement: HTMLElement;
  let admin: any;
  const preview = {
    mod: 'Wiki',
    current: { plugin: [] },
    proposed: { plugin: [] },
    target: { plugin: [] },
    conflict: false,
  } as any;

  beforeEach(async () => {
    admin = {
      init$: of(null),
      getPlugin(tag?: string) { return tag === 'plugin/mod' ? { tag } : undefined; },
      getTemplate(tag?: string) { return tag === 'config/diff' ? { tag } : undefined; },
      getMod() { return preview.target; },
      getInstalledMod(mod: string) {
        return admin.status.modRefs[mod]?.plugins?.['plugin/mod'];
      },
      getCurrentMod(mod: string) {
        const base = admin.getInstalledMod(mod) || admin.getMod(mod) || {};
        const basePluginTags = new Set((base.plugin || []).map((entry: any) => entry.tag));
        const baseTemplateTags = new Set((base.template || []).map((entry: any) => entry.tag));
        return {
          ...base,
          plugin: [...Object.values(admin.status.plugins), ...Object.values(admin.status.disabledPlugins)]
            .filter((entry: any) => entry && (modId(entry) === mod || basePluginTags.has(entry.tag)))
            .map((entry: any) => ({ ...entry, origin: '' })),
          template: [...Object.values(admin.status.templates), ...Object.values(admin.status.disabledTemplates)]
            .filter((entry: any) => entry && (modId(entry) === mod || baseTemplateTags.has(entry.tag)))
            .map((entry: any) => ({ ...entry, origin: '' })),
        };
      },
      loadModRefsFor$: vi.fn(() => of(null)),
      install$() { return of(null); },
      logModReceipt$: vi.fn(() => of(null)),
      installMod$: vi.fn(() => of(null)),
      deleteMod$() { return of(null); },
      deletePlugin$: vi.fn(() => of(null)),
      installPlugin$: vi.fn(() => of(null)),
      updatePlugin$: vi.fn(() => of(null)),
      deleteTemplate$: vi.fn(() => of(null)),
      installTemplate$: vi.fn(() => of(null)),
      updateTemplate$: vi.fn(() => of(null)),
      updateMod$: vi.fn(() => of(null)),
      def: { plugins: {}, templates: {} },
      status: { plugins: {}, templates: {}, disabledPlugins: {}, disabledTemplates: {}, modRefs: {} }
    };
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SettingsSetupPage,
      ],
      providers: [
        {
          provide: AdminService,
          useValue: admin,
        },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NGX_MONACO_EDITOR_CONFIG,
          useValue: {}
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsSetupPage);
    component = fixture.componentInstance;
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerElement = overlayContainer.getContainerElement();
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

  it('should preload installed mod receipts for active setup mods', async () => {
    admin.def.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      config: { mod: 'Wiki' },
    };
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki' },
    };

    fixture = TestBed.createComponent(SettingsSetupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(admin.loadModRefsFor$).toHaveBeenCalledWith(['Wiki']);
  });

  it('should open the merge diff in a popup', () => {
    admin.getMod = () => preview.target;
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
      _needsUpdate: true,
    };
    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any);
    fixture.detectChanges();

    expect(overlayContainerElement.querySelector('.merge-popup')).toBeTruthy();
    expect(overlayContainerElement.textContent).toContain('Wiki');
  });

  it('should close the merge popup when cancelled', () => {
    admin.getMod = () => preview.target;
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
      _needsUpdate: true,
    };
    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any);
    fixture.detectChanges();

    component.cancelMerge();
    fixture.detectChanges();

    expect(component.mergeState).toBeUndefined();
    expect(overlayContainerElement.querySelector('.merge-popup')).toBeFalsy();
  });

  it('should flag locally edited mods using the installed mod ref bundle', () => {
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 2, description: 'edited' },
    };
    admin.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/wiki',
            config: { mod: 'Wiki', version: 2 },
          }],
        },
      },
    };

    expect(component.modModified({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(true);
  });

  it('should flag locally edited mods when an edited template no longer carries config.mod', () => {
    admin.status.templates['config/wiki'] = {
      tag: 'config/wiki',
      origin: '@local',
      config: { description: 'edited' },
    };
    admin.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          template: [{
            tag: 'config/wiki',
            config: { mod: 'Wiki', version: 1 },
          }],
        },
      },
    };

    expect(component.modModified({ tag: 'config/wiki', config: { mod: 'Wiki' } } as any)).toBe(true);
  });

  it('should treat mods without an installed mod ref as unmodified in setup status', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited', generated: true, _parent: { test: true } },
    };

    expect(component.modModified({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(false);
  });

  it('should ignore stale installed mod receipts when the mod is not currently installed', () => {
    admin.status.modRefs.Wiki = {
      url: 'internal:55555555-5555-4555-8555-555555555555',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/wiki',
            config: { mod: 'Wiki', version: 1 },
          }],
        },
      },
    };

    expect(component.modModified({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(false);
  });

  it('should require review when local edits exist without a stored mod ref', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited', generated: true, _parent: { test: true } },
    };

    expect((component as any).getModUpdatePreview('Wiki')).toEqual(expect.objectContaining({
      needsReview: true,
      conflict: true,
      reason: 'missing-base',
    }));
  });

  it('should require review when the stored base still conflicts with admin edits', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    };
    admin.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } }],
        },
      },
    };

    expect((component as any).getModUpdatePreview('Wiki')).toEqual(expect.objectContaining({
      needsReview: true,
      conflict: true,
      reason: 'conflict',
      proposed: expect.objectContaining({
        plugin: [expect.objectContaining({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } })],
      }),
    }));
  });

  it('should preserve needsUpdate metadata after opening a mod diff preview', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
      _needsUpdate: true,
    };
    admin.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } }],
        },
      },
    };

    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any);

    expect(admin.status.plugins['plugin/wiki']._needsUpdate).toBe(true);
    expect(admin.status.plugins['plugin/wiki'].config?.mod).toBe('Wiki');
  });

  it('should reconcile plugin and template changes when applying a mod update', () => {
    component.mergeState = {
      mod: 'Wiki',
      current: { plugin: [] },
      target: { template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }] },
      proposed: { template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }] },
      needsReview: true,
      conflict: false,
    };

    component.applyMerge({ template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }] } as any);

    expect(admin.updateMod$).toHaveBeenCalledWith('Wiki', { template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }] }, { template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }] }, expect.any(Function));
  });

  it('should restore cleared config fields before applying an edited mod diff', () => {
    component.mergeState = {
      mod: 'Wiki',
      current: { plugin: [] },
      target: {
        plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2, generated: true, _parent: { test: true } } }],
      },
      proposed: {
        plugin: [{ tag: 'plugin/wiki', config: { description: 'edited' } }],
      },
      needsReview: true,
      conflict: false,
    };

    component.applyMerge({ plugin: [{ tag: 'plugin/wiki', config: { description: 'edited' } }] } as any);

    expect(admin.updateMod$).toHaveBeenCalledWith('Wiki', { plugin: [{ tag: 'plugin/wiki', config: { description: 'edited' } }] }, {
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2, generated: true, _parent: { test: true } } }],
    }, expect.any(Function));
  });

  it('should install new plugins from an edited mod diff without target metadata', () => {
    component.mergeState = {
      mod: 'Wiki',
      current: { plugin: [] },
      target: { plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }] },
      proposed: { plugin: [{ tag: 'plugin/new', config: { description: 'new plugin' } }] },
      needsReview: true,
      conflict: false,
    };

    component.applyMerge({ plugin: [{ tag: 'plugin/new', config: { description: 'new plugin' } }] } as any);

    expect(admin.updateMod$).toHaveBeenCalledWith('Wiki', { plugin: [{ tag: 'plugin/new', config: { description: 'new plugin' } }] }, {
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    }, expect.any(Function));
  });

  it('should disable 3-way merge when plugin/mod is not installed', () => {
    admin.getPlugin = () => undefined;
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    };

    expect((component as any).getModUpdatePreview('Wiki')).toEqual(expect.objectContaining({
      needsReview: false,
      conflict: false,
      proposed: expect.objectContaining({
        plugin: [expect.objectContaining({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } })],
      }),
    }));
  });

  it('should disable diffing when config/diff is not installed', () => {
    admin.getTemplate = () => undefined;
    admin.getMod = () => preview.target;

    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any);

    expect(component.mergeState).toBeUndefined();
    expect(component.canDiffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' }, _needsUpdate: true } as any)).toBe(false);
  });

  it('should log receipts after installing mods when store support is enabled by the save', () => {
    admin.getPlugin = () => undefined;
    admin.def.plugins = {
      'plugin/mod': { tag: 'plugin/mod', config: { mod: '🎁️ Store' } },
      'plugin/wiki': { tag: 'plugin/wiki', config: { mod: 'Wiki' } },
    };
    admin.getMod = (mod: string) => ({
      plugin: [{ tag: mod === '🎁️ Store' ? 'plugin/mod' : 'plugin/wiki', config: { mod } }],
    });
    component.adminForm = new UntypedFormGroup({
      mods: new UntypedFormGroup({
        'plugin/mod': new UntypedFormControl(true),
        'plugin/wiki': new UntypedFormControl(true),
      }),
    });

    component.install();

    expect(admin.installMod$).toHaveBeenCalledWith('🎁️ Store', expect.any(Function), false);
    expect(admin.installMod$).toHaveBeenCalledWith('Wiki', expect.any(Function), false);
    expect(admin.logModReceipt$).toHaveBeenCalledTimes(2);
  });
});
