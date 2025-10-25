/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor';

import { JsonComponent } from './json.component';

describe('JsonComponent', () => {
  let component: JsonComponent;
  let fixture: ComponentFixture<JsonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NGX_MONACO_EDITOR_CONFIG,
          useValue: {}
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonComponent);
    component = fixture.componentInstance;
    // Create a FormGroup for the component with all required controls
    component.group = new UntypedFormGroup({
      json: new UntypedFormControl(''),
      source: new UntypedFormControl('')
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
