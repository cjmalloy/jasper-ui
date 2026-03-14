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
  const preview = {
    mod: 'Wiki',
    current: { plugin: [] },
    proposed: { plugin: [] },
    target: { plugin: [] },
    conflict: false,
  } as any;

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
            getModUpdatePreview() { return preview; },
            def: { plugins: {}, templates: {} },
            status: { plugins: {}, templates: {}, disabledPlugins: {}, disabledTemplates: {} }
          }
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
    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any);
    fixture.detectChanges();

    expect(overlayContainerElement.querySelector('.merge-popup')).toBeTruthy();
    expect(overlayContainerElement.textContent).toContain('Wiki');
  });

  it('should close the merge popup when cancelled', () => {
    component.diffMod({ tag: 'plugin/wiki', config: { mod: 'Wiki' } } as any);
    fixture.detectChanges();

    component.cancelMerge();
    fixture.detectChanges();

    expect(component.mergeState).toBeUndefined();
    expect(overlayContainerElement.querySelector('.merge-popup')).toBeFalsy();
  });
});
