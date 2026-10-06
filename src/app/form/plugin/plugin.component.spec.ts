/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { PluginFormComponent } from './plugin.component';

describe('PluginFormComponent', () => {
  let component: PluginFormComponent;
  let fixture: ComponentFixture<PluginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PluginFormComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PluginFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({
      tag: new UntypedFormControl(),
      name: new UntypedFormControl(),
      config: new UntypedFormControl(),
      defaults: new UntypedFormControl(),
      schema: new UntypedFormControl(),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
