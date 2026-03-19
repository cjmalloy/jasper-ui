/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { isEqual } from 'lodash-es';
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
      needsUpdate(def: any, status: any) {
        if (def?.config?.version !== undefined) {
          if (status?.config?.version === undefined) return true;
          if (def.config.version !== status.config.version) {
            return def.config.version > status.config.version;
          }
          return false;
        }
        return !isEqual(def?.config || {}, status?.config || {});
      },
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
      loadAllModRefs$: vi.fn(() => of(null)),
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should preload installed mod receipts on setup page load', async () => {
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

    expect(admin.loadAllModRefs$).toHaveBeenCalled();
  });

  it('should preload installed mod receipts on setup page load with special-character mod ids', async () => {
    admin.def.plugins['plugin/mod'] = {
      tag: 'plugin/mod',
      config: { mod: '🎁️ Store' },
    };
    admin.status.plugins['plugin/mod'] = {
      tag: 'plugin/mod',
      origin: '@local',
      config: { mod: '🎁️ Store' },
    };

    fixture = TestBed.createComponent(SettingsSetupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(admin.loadAllModRefs$).toHaveBeenCalled();
  });

  it('should preload mod receipts on setup page load when an edited template loses config.mod', async () => {
    admin.def.templates['config/wiki'] = {
      tag: 'config/wiki',
      config: { mod: 'Wiki' },
    };
    admin.status.templates['config/wiki'] = {
      tag: 'config/wiki',
      origin: '@local',
      config: { description: 'edited' },
    };

    fixture = TestBed.createComponent(SettingsSetupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(admin.loadAllModRefs$).toHaveBeenCalled();
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

  it('should log each changed plugin/template once when the modified indicator is shown', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const wikiConfig = { tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any;
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 2, description: 'edited' },
    };
    admin.status.templates['config/wiki'] = {
      tag: 'config/wiki',
      origin: '@local',
      config: { mod: 'Wiki', description: 'edited template' },
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
          template: [{
            tag: 'config/wiki',
            config: { mod: 'Wiki' },
          }],
        },
      },
    };

    expect(component.modModified(wikiConfig)).toBe(true);
    expect(component.modModified(wikiConfig)).toBe(true);

    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenNthCalledWith(1, 'Has custom changes:', 'plugin/wiki');
    expect(log).toHaveBeenNthCalledWith(2, 'Has custom changes:', 'config/wiki');
  });

  it('should re-log modified indicators after setup state is reloaded', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const wikiConfig = { tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any;
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

    expect(component.modModified(wikiConfig)).toBe(true);

    component.clear();

    expect(component.modModified(wikiConfig)).toBe(true);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('should keep modified state stable when unrelated mods change', () => {
    const wikiConfig = { tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any;
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

    expect(component.modModified(wikiConfig)).toBe(true);

    admin.status.plugins['plugin/other'] = {
      tag: 'plugin/other',
      origin: '@local',
      config: { mod: 'Other', version: 1, description: 'edited' },
    };
    admin.status.modRefs.Other = {
      url: 'mod:Other',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/other',
            config: { mod: 'Other', version: 1 },
          }],
        },
      },
    };

    expect(component.modModified(wikiConfig)).toBe(true);
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

  it('should flag versioned mods without a receipt when setup falls back to a 2-way merge', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited', generated: true, _parent: { test: true } },
    };

    expect(component.modModified({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } } as any)).toBe(true);
    expect(component.canDiffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } } as any)).toBe(true);
    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } } as any);
    expect(component.mergeState).toEqual(expect.objectContaining({
      mod: 'Wiki',
      needsReview: true,
      conflict: false,
    }));
  });

  it('should ignore unversioned mods without an installed mod ref in setup status', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', description: 'edited' },
    };

    expect(component.modModified({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(false);
    expect(component.canDiffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(false);
  });

  it('should hide the update action for unversioned mods with receipts when only local custom changes remain', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', description: 'edited' },
      _needsUpdate: true,
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
    expect(component.hasPendingModUpdate({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(false);
    expect(component.canDiffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(true);
  });

  it('should skip custom-only unversioned receipt mods during update all', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', description: 'edited' },
      _needsUpdate: true,
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

    component.updateAll();

    expect(admin.updateMod$).not.toHaveBeenCalled();
    expect(component.submitted).toBe(true);
  });

  it('should not log when the modified indicator is not shown', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    admin.status.modRefs.Wiki = {
      url: 'mod:Wiki',
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
    expect(log).not.toHaveBeenCalled();
  });

  it('should not mark a mod modified when only non-plugin/template bundle data differs', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };
    admin.getInstalledMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } }],
    });
    admin.getCurrentMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } }],
      ref: [{ url: 'https://example.com', origin: '' }],
    });

    expect(component.modModified({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it('should not mark a mod modified when only config metadata fields differ after change detection', () => {
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      modified: { toISO: () => '2024-01-02T00:00:00Z' },
      modifiedString: '2024-01-02T00:00:00Z',
      config: { mod: 'Wiki', version: 1 },
    };
    admin.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/wiki',
            modified: { toISO: () => '2024-01-01T00:00:00Z' },
            modifiedString: '2024-01-01T00:00:00Z',
            config: { mod: 'Wiki', version: 1 },
          }],
        },
      },
    };

    expect(component.modModified({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any)).toBe(false);
  });

  it('should not mark a mod modified when only _needsUpdate flag differs', () => {
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
          plugin: [{
            tag: 'plugin/wiki',
            config: { mod: 'Wiki', version: 1 },
          }],
        },
      },
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

  it('should auto-apply target when local edits exist without a stored mod ref', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    });
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited', generated: true, _parent: { test: true } },
    };

    expect((component as any).getModUpdatePreview('Wiki')).toEqual(expect.objectContaining({
      needsReview: false,
      conflict: false,
    }));
  });

  it('should require review when the stored base still conflicts with admin edits', () => {
    admin.getMod = () => ({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2, description: 'upstream' } }],
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
      diffBase: expect.objectContaining({
        plugin: [expect.objectContaining({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2, description: 'upstream' } })],
      }),
      proposed: expect.objectContaining({
        plugin: [expect.objectContaining({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1, description: 'edited' } })],
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
      diffBase: { plugin: [] },
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
      diffBase: {
        plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2, generated: true, _parent: { test: true } } }],
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
      diffBase: { plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }] },
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
