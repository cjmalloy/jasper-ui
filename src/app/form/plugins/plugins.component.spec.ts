/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { PluginsFormComponent } from './plugins.component';

describe('PluginsFormComponent', () => {
  let component: PluginsFormComponent;
  let fixture: ComponentFixture<PluginsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        PluginsFormComponent
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PluginsFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', new UntypedFormGroup({
      tags: new UntypedFormArray([]),
      plugins: new UntypedFormGroup({}),
    }));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refreshes a cached plugin control after init adds it dynamically', () => {
    fixture.componentRef.setInput('fieldName', 'dynamicPlugins');
    expect(component.plugins()).toBeNull();
    component.init();
    expect(component.plugins()).toBe(component.group().get('dynamicPlugins'));
    expect(component.empty()).toBe(true);
    component.plugins().addControl('custom', new UntypedFormControl('value'));
    expect(component.empty()).toBe(false);
  });
});
