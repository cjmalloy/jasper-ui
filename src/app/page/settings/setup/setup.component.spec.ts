/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { NEVER, of, ReplaySubject, throwError } from 'rxjs';
import { provideJasperFormly } from '../../../formly/formly.config';
import { Mod } from '../../../model/tag';
import { Template } from '../../../model/template';
import { AdminService } from '../../../service/admin.service';
import { PluginService } from '../../../service/api/plugin.service';
import { TemplateService } from '../../../service/api/template.service';
import { Store } from '../../../store/store';

import { SettingsSetupPage } from './setup.component';

function mapTemplate(version: number, color: string, description = 'Map'): Template {
  return { tag: 'map', name: 'Map', config: { mod: 'Map', version, description, mapStyle: { color } } };
}

describe('SettingsSetupPage', () => {
  let component: SettingsSetupPage;
  let fixture: ComponentFixture<SettingsSetupPage>;
  let admin: any;
  let status: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        SettingsSetupPage,
      ],
      providers: [
        {
          provide: AdminService,
          useFactory: () => (status = { plugins: {}, templates: {}, disabledPlugins: {}, disabledTemplates: {}, receipts: {} }, admin = {
                init$: of(null),
                ready$: of(null),
                reload$: vi.fn(() => admin.ready$ = of(null)),
                loadModChanges$: vi.fn(() => of(null)),
                getPlugin() { },
                getTemplate() { },
                getMod() { },
                getInstalledMod() { },
                getTemplateAdminForm: vi.fn((tag: string) => status.templates[tag]?.config?.adminForm || []),
                updateMod$: vi.fn(() => of(null)),
                noMods: vi.fn(() => false),
                installingDefaults: signal(false),
                loading: signal(false),
                installDefaultsAndReload$: vi.fn(() => admin.ready$ = of(null)),
                def: { plugins: {}, templates: {} },
                status: () => status,
                themes: () => [],
            })
        },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        provideJasperFormly(),
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

  describe('loadModChanges', () => {
    const el = () => fixture.nativeElement as HTMLElement;

    it('should show a loading placeholder until mod changes load', () => {
      admin.loadModChanges$.mockReturnValue(NEVER);
      component.loadModChanges();
      fixture.detectChanges();
      expect(el().querySelector('.buttons .mod-changes-loading')).toBeTruthy();
      expect(el().querySelector('.mod-changes-error')).toBeNull();
    });

    it('should hide the placeholder once mod changes load', () => {
      expect(component.modChangesLoaded()).toBe(true);
      expect(el().querySelector('.mod-changes-loading')).toBeNull();
      expect(el().querySelector('.mod-changes-error')).toBeNull();
    });

    it('should show an error with retry if mod changes fail to load', () => {
      admin.loadModChanges$.mockReturnValue(throwError(() => new Error('Network down')));
      component.loadModChanges();
      fixture.detectChanges();
      expect(component.modChangesLoaded()).toBe(false);
      expect(el().querySelector('.mod-changes-loading')).toBeNull();
      expect(el().querySelector('.mod-changes-error')?.textContent).toContain('Network down');

      admin.loadModChanges$.mockReturnValue(of(null));
      (el().querySelector('.mod-changes-retry') as HTMLElement).click();
      fixture.detectChanges();
      expect(component.modChangesLoaded()).toBe(true);
      expect(el().querySelector('.mod-changes-error')).toBeNull();
    });

    it('should wait for a reload started before reopening the page', () => {
      const init$ = new ReplaySubject<any>(1);
      admin.reload$ = () => admin.ready$ = init$;
      component.reset();
      fixture.destroy();
      admin.loadModChanges$.mockClear();

      fixture = TestBed.createComponent(SettingsSetupPage);
      component = fixture.componentInstance;
      const clear = vi.spyOn(component, 'clear');
      fixture.detectChanges();
      expect(admin.loadModChanges$).not.toHaveBeenCalled();
      expect(component.modChangesLoaded()).toBe(false);

      init$.next(null);
      init$.complete();
      expect(clear).toHaveBeenCalled();
      expect(admin.loadModChanges$).toHaveBeenCalledTimes(1);
      expect(component.modChangesLoaded()).toBe(true);
    });
  });

  describe('installDefaults', () => {
    const el = () => fixture.nativeElement as HTMLElement;

    function recreate() {
      fixture.destroy();
      fixture = TestBed.createComponent(SettingsSetupPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    }

    it('should hide the button when mods are installed', () => {
      TestBed.inject(Store).account.admin = true;
      recreate();
      expect(el().querySelector('.install-defaults')).toBeNull();
    });

    it('should hide the button for non-admins', () => {
      admin.noMods.mockReturnValue(true);
      recreate();
      expect(el().querySelector('.install-defaults')).toBeNull();
    });

    it('should hide the button while mods reload', () => {
      TestBed.inject(Store).account.admin = true;
      admin.noMods.mockReturnValue(true);
      admin.loading.set(true);
      recreate();
      expect(el().querySelector('.install-defaults')).toBeNull();
      admin.loading.set(false);
      fixture.detectChanges();
      expect(el().querySelector('.install-defaults')).toBeTruthy();
    });

    it('should install defaults when no mods are installed', () => {
      TestBed.inject(Store).account.admin = true;
      admin.noMods.mockReturnValue(true);
      recreate();
      const clear = vi.spyOn(component, 'clear');
      (el().querySelector('.install-defaults') as HTMLElement).click();
      expect(admin.installDefaultsAndReload$).toHaveBeenCalledTimes(1);
      expect(clear).toHaveBeenCalled();
      expect(component.modChangesLoaded()).toBe(true);
      expect(component.installMessages()).toContain('Success.');
    });

    it('should disable saving while defaults install', () => {
      TestBed.inject(Store).account.admin = true;
      admin.installingDefaults.set(true);
      recreate();
      expect(el().querySelector('.install-defaults')).toBeNull();
      expect(el().querySelectorAll('app-loading').length).toBe(1);
      expect(el().querySelector('.install-defaults-loading')).toBeTruthy();
      expect((el().querySelector('.buttons button:last-child') as HTMLButtonElement).disabled).toBe(true);
      component.install();
      expect(component.installMessages()).toEqual([]);
    });

    it('should report a failed install without reporting success', () => {
      TestBed.inject(Store).account.admin = true;
      admin.noMods.mockReturnValue(true);
      admin.installDefaultsAndReload$.mockImplementation(() => throwError(() => new Error('Install failed')));
      recreate();
      (el().querySelector('.install-defaults') as HTMLElement).click();
      expect(component.serverError()).toContainEqual(expect.stringContaining('Install failed'));
      expect(component.installMessages()).not.toContain('Success.');
    });
  });

  const custom = mapTemplate(1, 'black');
  const target: Mod = { template: [mapTemplate(2, 'blue', 'New Map')] };
  const receipt = { plugins: { 'plugin/mod': { template: [mapTemplate(1, 'blue')] } } };

  function customizeMap() {
    status.templates = { map: custom };
    admin.getInstalledMod = () => ({ template: [custom] });
    admin.getMod = () => target;
    TestBed.inject(Store).view.addModUpdate('Map');
    TestBed.inject(Store).view.setModChange('Map', true);
  }

  function expectMerged(bundle: Mod) {
    expect(bundle.template![0].config!.mapStyle).toEqual({ color: 'black' });
    expect(bundle.template![0].config!.description).toBe('New Map');
    expect(bundle.template![0].config!.version).toBe(2);
  }

  describe('updateMod', () => {
    beforeEach(() => {
      customizeMap();
      admin.getTemplate = (tag: string) => tag === 'config/diff' ? { tag } : undefined;
    });

    it('should not overwrite local changes when there is no receipt to merge with', () => {
      component.updateMod(custom);
      expect(admin.updateMod$).not.toHaveBeenCalled();
      expect(component.mergeState()?.conflict).toBe(true);
      expect(component.mergeState()?.proposed).toEqual({ template: [custom] });
    });

    it('should merge local changes with the update', () => {
      status.receipts['Map'] = receipt;
      component.updateMod(custom);
      expect(admin.updateMod$).toHaveBeenCalledTimes(1);
      expectMerged(admin.updateMod$.mock.calls[0][1]);
    });

    it('should install the stock mod without config/diff', () => {
      admin.getTemplate = () => undefined;
      component.updateMod(custom);
      expect(admin.updateMod$).toHaveBeenCalledTimes(1);
      expect(admin.updateMod$.mock.calls[0][1]).toBe(target);
    });
  });

  describe('updateAll', () => {
    beforeEach(() => customizeMap());

    it('should skip customized mods when there is no receipt to merge with', () => {
      component.updateAll();
      expect(admin.updateMod$).not.toHaveBeenCalled();
      expect(component.installMessages()).toContainEqual(expect.stringContaining('Skipped Map mod'));
    });

    it('should merge local changes with the update', () => {
      status.receipts['Map'] = receipt;
      component.updateAll();
      expect(admin.updateMod$).toHaveBeenCalledTimes(1);
      expectMerged(admin.updateMod$.mock.calls[0][1]);
      expect(component.installMessages()).not.toContainEqual(expect.stringContaining('Skipped'));
    });
  });

  describe('configMod', () => {
    const adminForm = [{ key: 'title', type: 'string' }];
    const plugin = { tag: 'plugin/a', name: 'A', origin: '', config: { mod: 'Combo', title: 'a', adminForm } };
    const other = { tag: 'plugin/b', name: 'B', origin: '', config: { mod: 'Combo' } };
    const template = { tag: 'combo', name: 'Combo', origin: '', config: { mod: 'Combo', title: 't', adminForm } };

    beforeEach(() => {
      status.plugins = { 'plugin/a': plugin, 'plugin/b': other };
      status.templates = { combo: template };
      admin.getInstalledMod = () => ({ plugin: [plugin, other], template: [template] });
    });

    afterEach(() => component.cancelConfig());

    it('should show a config link only for installed mods with admin forms', () => {
      expect(component.hasAdminForm(plugin)).toBe(true);
      admin.getInstalledMod = () => ({ plugin: [other], template: [] });
      expect(component.hasAdminForm(other)).toBe(false);
      admin.getInstalledMod = () => undefined;
      expect(component.hasAdminForm(plugin)).toBe(false);
    });

    it('should combine every admin form in the mod', () => {
      component.configMod(plugin);
      fixture.detectChanges();
      expect(component.configState()!.entries.map(e => e.entity.tag)).toEqual(['plugin/a', 'combo']);
      expect(document.querySelectorAll('.mod-config-popup .mod-config-form').length).toBe(2);
    });

    it('should only save changed configs', () => {
      const plugins = TestBed.inject(PluginService);
      const templates = TestBed.inject(TemplateService);
      const updatePlugin = vi.spyOn(plugins, 'update').mockReturnValue(of('cursor'));
      const updateTemplate = vi.spyOn(templates, 'update').mockReturnValue(of('cursor'));
      component.configMod(plugin);
      const entry = component.configState()!.entries[1];
      entry.group.controls.config.setValue(JSON.stringify({ ...template.config, title: 'changed' }));
      entry.group.markAsDirty();
      component.saveConfig();
      expect(updatePlugin).not.toHaveBeenCalled();
      expect(updateTemplate).toHaveBeenCalledWith(expect.objectContaining({ tag: 'combo', config: expect.objectContaining({ title: 'changed' }) }));
      expect(component.configState()).toBeUndefined();
      expect(admin.reload$).toHaveBeenCalled();
      expect(component.installMessages()).toContainEqual('Saved Combo config.');
    });

    it('should keep the popup open on server errors', () => {
      const templates = TestBed.inject(TemplateService);
      vi.spyOn(templates, 'update').mockReturnValue(throwError(() => ({ status: 500, message: 'boom' })));
      component.configMod(plugin);
      const entry = component.configState()!.entries[1];
      entry.group.markAsDirty();
      component.saveConfig();
      expect(component.configState()).toBeTruthy();
      expect(component.configErrors().length).toBeGreaterThan(0);
      expect(component.configSaving()).toBe(false);
    });

    it('should not dismiss the popup while saving', () => {
      vi.spyOn(TestBed.inject(TemplateService), 'update').mockReturnValue(NEVER);
      component.configMod(plugin);
      component.configState()!.entries[1].group.markAsDirty();
      component.saveConfig();
      document.querySelector('.cdk-overlay-backdrop')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.querySelector('.mod-config-popup')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(component.configState()).toBeTruthy();
      expect(component.configSaving()).toBe(true);
    });

    it('should refresh mods and keep unsaved edits after a partial failure', () => {
      vi.spyOn(TestBed.inject(PluginService), 'update').mockReturnValue(of('cursor'));
      vi.spyOn(TestBed.inject(TemplateService), 'update').mockReturnValue(throwError(() => ({ status: 500, message: 'boom' })));
      component.configMod(plugin);
      const [saved, failed] = component.configState()!.entries;
      saved.group.markAsDirty();
      failed.group.markAsDirty();
      component.saveConfig();
      expect(admin.reload$).toHaveBeenCalled();
      expect(saved.group.dirty).toBe(false);
      expect(failed.group.dirty).toBe(true);
      expect(component.configState()).toBeTruthy();
    });

    it('should resend a saved entry with its new cursor after a partial failure', () => {
      const updatePlugin = vi.spyOn(TestBed.inject(PluginService), 'update').mockReturnValue(of('2024-01-02T00:00:00Z'));
      vi.spyOn(TestBed.inject(TemplateService), 'update').mockReturnValue(throwError(() => ({ status: 500, message: 'boom' })));
      component.configMod(plugin);
      const [saved, failed] = component.configState()!.entries;
      saved.entity.modifiedString = '2024-01-01T00:00:00Z';
      saved.group.controls.config.setValue(JSON.stringify({ ...plugin.config, title: 'first' }));
      saved.group.markAsDirty();
      failed.group.markAsDirty();
      component.saveConfig();
      saved.group.controls.config.setValue(JSON.stringify({ ...plugin.config, title: 'second' }));
      saved.group.markAsDirty();
      component.saveConfig();
      expect(updatePlugin).toHaveBeenCalledTimes(2);
      expect(updatePlugin.mock.calls[1][0]).toEqual(expect.objectContaining({
        modifiedString: '2024-01-02T00:00:00Z',
        config: expect.objectContaining({ title: 'second' }),
      }));
    });
  });
});
