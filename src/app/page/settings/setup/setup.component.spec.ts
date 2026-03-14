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
      getPlugin() { },
      getTemplate() { },
      getMod() { return preview.target; },
      install$() { return of(null); },
      logModReceipt$: vi.fn(() => of(null)),
      installMod$() { return of(null); },
      deleteMod$() { return of(null); },
      deletePlugin$: vi.fn(() => of(null)),
      installPlugin$: vi.fn(() => of(null)),
      updatePlugin$: vi.fn(() => of(null)),
      deleteTemplate$: vi.fn(() => of(null)),
      installTemplate$: vi.fn(() => of(null)),
      updateTemplate$: vi.fn(() => of(null)),
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

  it('should open the merge diff in a popup', () => {
    admin.getMod = () => preview.target;
    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any);
    fixture.detectChanges();

    expect(overlayContainerElement.querySelector('.merge-popup')).toBeTruthy();
    expect(overlayContainerElement.textContent).toContain('Wiki');
  });

  it('should close the merge popup when cancelled', () => {
    admin.getMod = () => preview.target;
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
    admin.status.plugins['plugin/wiki'] = { tag: 'plugin/wiki', origin: '@local', config: { mod: 'Wiki' } };

    (component as any).applyModUpdate$('Wiki', {
      template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }],
    }, {
      template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }],
    }, () => {}).subscribe(() => {});

    expect(admin.deletePlugin$).toHaveBeenCalled();
    expect(admin.installTemplate$).toHaveBeenCalled();
  });

  it('should restore cleared config fields before applying an edited mod diff', () => {
    admin.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    };

    (component as any).applyModUpdate$('Wiki', {
      plugin: [{ tag: 'plugin/wiki', config: { description: 'edited' } }],
    }, {
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2, generated: true, _parent: { test: true } } }],
    }, () => {}).subscribe(() => {});

    expect(admin.updatePlugin$).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'plugin/wiki',
      config: { mod: 'Wiki', version: 2, generated: true, _parent: { test: true }, description: 'edited' },
    }), expect.any(Function));
  });

  it('should install new plugins from an edited mod diff without target metadata', () => {
    (component as any).applyModUpdate$('Wiki', {
      plugin: [{ tag: 'plugin/new', config: { description: 'new plugin' } }],
    }, {
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } }],
    }, () => {}).subscribe(() => {});

    expect(admin.installPlugin$).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'plugin/new',
      config: { description: 'new plugin' },
    }), expect.any(Function));
  });
});
