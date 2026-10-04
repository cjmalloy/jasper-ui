/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideJasperFormly } from '../../formly/formly.config';

import { AdminConfigComponent } from './admin-config.component';

describe('AdminConfigComponent', () => {
  let component: AdminConfigComponent;
  let fixture: ComponentFixture<AdminConfigComponent>;

  let group: UntypedFormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminConfigComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        provideJasperFormly(),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminConfigComponent);
    component = fixture.componentInstance;
    group = new UntypedFormGroup({
      config: new UntypedFormControl(JSON.stringify({ script: 'a', other: 1 })),
    });
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('fields', [{ key: 'script', type: 'string' }]);
    fixture.detectChanges();
  });

  it('should read the model from JSON', () => {
    expect(component.model()).toEqual({ script: 'a', other: 1 });
  });

  it('should write model changes back to JSON', () => {
    component.modelChange({ ...component.model(), script: 'b' });
    expect(JSON.parse(group.get('config')!.value)).toEqual({ script: 'b', other: 1 });
    expect(group.get('config')!.dirty).toBe(true);
  });

  it('should update the model when JSON changes', () => {
    group.get('config')!.setValue(JSON.stringify({ script: 'c' }));
    expect(component.model()).toEqual({ script: 'c' });
  });

  it('should keep the last valid model on invalid JSON', () => {
    group.get('config')!.setValue('{');
    expect(component.model()).toEqual({ script: 'a', other: 1 });
  });

  it('should propagate form validity to the JSON control', () => {
    fixture.componentRef.setInput('fields', [{ key: 'required', type: 'string', props: { required: true } }]);
    fixture.detectChanges();
    expect(component.form.invalid).toBe(true);
    expect(group.invalid).toBe(true);
    component.form.get('required')!.setValue('x');
    expect(group.valid).toBe(true);
  });

  it('should remove the validator on destroy', () => {
    fixture.componentRef.setInput('fields', [{ key: 'required', type: 'string', props: { required: true } }]);
    fixture.detectChanges();
    expect(group.invalid).toBe(true);
    fixture.destroy();
    expect(group.valid).toBe(true);
  });
});
