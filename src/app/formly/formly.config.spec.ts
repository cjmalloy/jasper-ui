/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { FormlyConfig, FormlyFieldConfig, FormlyFormBuilder } from '@ngx-formly/core';
import { getErrorMessage } from './errors';
import { provideJasperFormly } from './formly.config';

describe('provideJasperFormly', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideJasperFormly()],
    });
  });

  function build(model: any, props: any) {
    const form = new FormGroup({});
    const field: FormlyFieldConfig = { key: 'radius', type: 'range', props };
    TestBed.inject(FormlyFormBuilder).build({ form, model, options: {}, fieldGroup: [field] });
    return field;
  }

  it('accepts range values on a step', () => {
    const field = build({ radius: 8 }, { min: 0, max: 24, step: 4 });
    expect(field.formControl!.valid).toBe(true);
  });

  it('explains range values off a step', () => {
    const field = build({ radius: 5 }, { min: 0, max: 24, step: 4 });
    expect(field.formControl!.errors?.['step']).toBeTruthy();
    expect(getErrorMessage(field, TestBed.inject(FormlyConfig))).toBe('Must be a multiple of 4');
  });

  it('explains range values off a step from min', () => {
    const field = build({ radius: 4 }, { min: 1, max: 24, step: 2 });
    expect(getErrorMessage(field, TestBed.inject(FormlyConfig))).toBe('Must be 1 plus a multiple of 2');
  });
});
