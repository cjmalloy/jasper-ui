/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { Store } from '../store/store';
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

describe('FormlyFieldSelect', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideJasperFormly(),
      { provide: Store, useValue: { hotkey: () => false } },
    ] });
  });

  async function render(field: FormlyFieldConfig, model: any = {}) {
    const fixture = TestBed.createComponent(FormlyHost);
    fixture.componentInstance.fields = [field];
    fixture.componentInstance.model = model;
    await fixture.whenStable();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    return { select, empty: select.querySelector<HTMLOptionElement>('option.select-empty') };
  }

  const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

  it('has an explicit empty option when optional', async () => {
    const { select, empty } = await render({ key: 's', type: 'select', props: { options } });
    expect(empty).toBeTruthy();
    expect(empty!.hidden).toBe(false);
    expect(empty!.disabled).toBe(false);
    expect(select.selectedIndex).toBe(0);
  });

  it('hides the empty option when required', async () => {
    const { empty } = await render({ key: 's', type: 'enum', props: { options, required: true } });
    expect(empty!.hidden).toBe(true);
    expect(empty!.disabled).toBe(true);
  });

  it('selects the default value', async () => {
    const { select, empty } = await render({ key: 's', type: 'select', defaultValue: 'b', props: { options } });
    expect(empty!.hidden).toBe(true);
    expect(select.selectedOptions[0].textContent!.trim()).toBe('B');
  });

  it('hides the empty option in a list', async () => {
    const { empty } = await render({ key: 's', type: 'list', fieldArray: { type: 'enum', props: { options } } }, { s: ['a'] });
    expect(empty!.hidden).toBe(true);
    expect(empty!.disabled).toBe(true);
  });
});
