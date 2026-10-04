/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';

import { AdminConfigComponent } from './admin-config.component';

describe('AdminConfigComponent', () => {
  let component: AdminConfigComponent;
  let fixture: ComponentFixture<AdminConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JasperFormlyModule, AdminConfigComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminConfigComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({
      config: new UntypedFormControl(JSON.stringify({ script: 'a', other: 1 })),
    });
    component.fields = [{ key: 'script', type: 'string' }];
    fixture.detectChanges();
  });

  it('should read the model from JSON', () => {
    expect(component.model).toEqual({ script: 'a', other: 1 });
  });

  it('should write model changes back to JSON', () => {
    component.modelChange({ ...component.model, script: 'b' });
    expect(JSON.parse(component.group.get('config')!.value)).toEqual({ script: 'b', other: 1 });
    expect(component.group.get('config')!.dirty).toBe(true);
  });

  it('should update the model when JSON changes', () => {
    component.group.get('config')!.setValue(JSON.stringify({ script: 'c' }));
    expect(component.model).toEqual({ script: 'c' });
  });

  it('should keep the last valid model on invalid JSON', () => {
    component.group.get('config')!.setValue('{');
    expect(component.model).toEqual({ script: 'a', other: 1 });
  });
});
