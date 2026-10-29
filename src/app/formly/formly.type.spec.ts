/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { AdminService } from '../service/admin.service';
import { Store } from '../store/store';
import { provideJasperFormly } from './formly.config';

@Component({
  template: `<formly-form [form]="form" [model]="model" [fields]="fields" />`,
  imports: [FormlyForm],
})
class FormlyHost {
  form = new FormGroup({});
  model: any = {};
  fields: FormlyFieldConfig[] = [{ key: 'form', type: 'formly' }];
}

describe('formly type', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideJasperFormly(),
        { provide: Store, useValue: { hotkey: () => false } },
        { provide: AdminService, useValue: { getPlugin: () => undefined } },
      ],
    });
  });

  async function render(model: any) {
    const fixture = TestBed.createComponent(FormlyHost);
    fixture.componentInstance.model = model;
    await fixture.whenStable();
    return { fixture, field: fixture.componentInstance.fields[0] };
  }

  function child(item: FormlyFieldConfig, key: string) {
    return item.fieldGroup!.find(f => f.key === key)!;
  }

  it('edits a list of field configs', async () => {
    const { field } = await render({ form: [{ key: 'title', type: 'string', props: { label: 'Title:' } }] });
    const item = field.fieldGroup![0];
    expect(child(item, 'key').formControl!.value).toBe('title');
    expect(child(item, 'type').formControl!.value).toBe('string');
    expect(child(item, 'props.label').formControl!.value).toBe('Title:');
  });

  it('offers every registered type', async () => {
    const { field } = await render({ form: [{ key: 'title', type: 'string' }] });
    const options = child(field.fieldGroup![0], 'type').props!.options as { value: string }[];
    const values = options.map(o => o.value);
    expect(values).toContain('string');
    expect(values).toContain('select');
    expect(values).toContain('formly');
    expect(values).toContain('tags');
    expect(values).not.toContain('list');
  });

  it('shows options only for option types', async () => {
    const { field } = await render({ form: [
      { key: 'a', type: 'string' },
      { key: 'b', type: 'select', props: { options: [{ value: 'x', label: 'X' }] } },
    ] });
    expect(child(field.fieldGroup![0], 'props.options').hide).toBe(true);
    const options = child(field.fieldGroup![1], 'props.options');
    expect(options.hide).toBeFalsy();
    expect(options.formControl!.value).toEqual([{ value: 'x', label: 'X' }]);
  });

  it('shows options after changing to an option type', async () => {
    const { fixture, field } = await render({ form: [{ key: 'a', type: 'string' }] });
    const item = field.fieldGroup![0];
    expect(child(item, 'props.options').hide).toBe(true);
    child(item, 'type').formControl!.setValue('radio');
    await fixture.whenStable();
    expect(child(item, 'props.options').hide).toBeFalsy();
    expect(child(item, 'fieldGroup').hide).toBe(true);
  });

  it('edits nested fields of groups', async () => {
    const { field } = await render({ form: [{ fieldGroup: [{ key: 'nested', type: 'number' }] }] });
    const group = child(field.fieldGroup![0], 'fieldGroup');
    expect(group.hide).toBeFalsy();
    expect(child(group.fieldGroup![0], 'key').formControl!.value).toBe('nested');
  });

  it('keeps field config properties not in the builder', async () => {
    const model = { form: [{ key: 'tags', type: 'tags', className: 'my-tags', props: { label: 'Tags:', addText: '+ tag' } }] };
    const { field } = await render(model);
    child(field.fieldGroup![0], 'props.label').formControl!.setValue('Labels:');
    expect(model.form[0]).toEqual({ key: 'tags', type: 'tags', className: 'my-tags', props: { label: 'Labels:', addText: '+ tag' } });
  });
});
