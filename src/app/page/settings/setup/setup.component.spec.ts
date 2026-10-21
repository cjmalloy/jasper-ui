/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Mod } from '../../../model/tag';
import { Template } from '../../../model/template';
import { AdminService } from '../../../service/admin.service';
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
                getPlugin() { },
                getTemplate() { },
                getMod() { },
                getInstalledMod() { },
                updateMod$: vi.fn(() => of(null)),
                def: { plugins: {}, templates: {} },
                status: () => status,
                themes: () => [],
            })
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
});
