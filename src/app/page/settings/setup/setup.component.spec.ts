/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { jezzballPlugin } from '../../../mods/games/jezzball';
import { scorePlugin } from '../../../mods/games/score';
import { AdminService } from '../../../service/admin.service';

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
                deleteMod$: vi.fn(() => of(null)),
                installMod$: vi.fn(() => of(null)),
                def: { plugins: {}, templates: {} },
                status: { plugins: {}, templates: {} }
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

  it('uses the displayed Score group when uninstalling a legacy JezzBall-owned score', () => {
    component.admin.def.plugins = {
      [scorePlugin.tag]: scorePlugin,
      [jezzballPlugin.tag]: jezzballPlugin,
    };
    component.admin.status.plugins = {
      [scorePlugin.tag]: { ...scorePlugin, config: { ...scorePlugin.config, mod: jezzballPlugin.config!.mod, version: 1 } },
      [jezzballPlugin.tag]: jezzballPlugin,
    };
    component.adminForm = new UntypedFormGroup({
      mods: new UntypedFormGroup({
        [scorePlugin.tag]: new UntypedFormControl(false),
        [jezzballPlugin.tag]: new UntypedFormControl(true),
      }),
    });
    vi.spyOn(component, 'reset').mockImplementation(() => {});

    component.install();

    expect(component.admin.deleteMod$).toHaveBeenCalledExactlyOnceWith(scorePlugin.config!.mod, expect.any(Function));
    expect(component.admin.installMod$).not.toHaveBeenCalled();
  });
});
