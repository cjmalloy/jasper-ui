/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { FormlyConfig, FormlyFieldConfig, FormlyForm, FormlyFormBuilder } from '@ngx-formly/core';
import { Store } from '../store/store';
import { getErrorMessage } from './errors';
import { provideJasperFormly } from './formly.config';

@Component({
  template: `<formly-form [form]="form" [model]="model" [fields]="fields" />`,
  imports: [FormlyForm],
})
class FormlyHost {
  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [];
}

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

  it('only accepts whole numbers for integers', () => {
    const form = new FormGroup({});
    const field: FormlyFieldConfig = { key: 'count', type: 'integer' };
    TestBed.inject(FormlyFormBuilder).build({ form, model: { count: 1.5 }, options: {}, fieldGroup: [field] });
    expect(field.props!.step).toBe(1);
    expect(getErrorMessage(field, TestBed.inject(FormlyConfig))).toBe('Must be a multiple of 1');
    field.formControl!.setValue(2);
    expect(field.formControl!.valid).toBe(true);
    field.formControl!.setValue(null);
    expect(field.formControl!.valid).toBe(true);
  });

  it('defaults a range to min', () => {
    const form = new FormGroup({});
    const model: any = {};
    const field: FormlyFieldConfig = { key: 'radius', type: 'range', props: { min: 4, max: 24, step: 4 } };
    TestBed.inject(FormlyFormBuilder).build({ form, model, options: {}, fieldGroup: [field] });
    expect(model.radius).toBe(4);
    expect(field.formControl!.valid).toBe(true);
  });

  it('has no default location', () => {
    const form = new FormGroup({});
    const model: any = {};
    const field: FormlyFieldConfig = { key: 'where', type: 'location' };
    TestBed.inject(FormlyFormBuilder).build({ form, model, options: {}, fieldGroup: [field] });
    expect(model.where).toBeUndefined();
    expect(field.formControl!.valid).toBe(true);
    field.formControl!.setValue([1, 2]);
    expect(field.formControl!.valid).toBe(true);
  });

  it('requires a location for each point in a list', async () => {
    TestBed.overrideProvider(Store, { useValue: { hotkey: () => false } });
    const fixture = TestBed.createComponent(FormlyHost);
    const field: FormlyFieldConfig = { key: 'points', type: 'list', fieldArray: { type: 'location' } };
    fixture.componentInstance.fields = [field];
    fixture.componentInstance.model = { points: [[1, 2], null] };
    await fixture.whenStable();
    const [first, second] = field.fieldGroup!;
    expect(first.formControl!.valid).toBe(true);
    expect(second.formControl!.errors?.['location']).toBeTruthy();
    expect(getErrorMessage(second, TestBed.inject(FormlyConfig))).toBe('Pick a location.');
  });
});
