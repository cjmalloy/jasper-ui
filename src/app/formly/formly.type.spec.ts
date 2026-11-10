/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm } from '@ngx-formly/core';
import { AdminService } from '../service/admin.service';
import { Store } from '../store/store';
import { provideJasperFormly } from './formly.config';
import { typeGroups, typeOptions } from './formly.type';

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
    expect(values).toContain('stencil');
    expect(values).not.toContain('child-plugin');
    expect(values).toContain('geometries');
    expect(values).not.toContain('userMap');
  });

  it('names and groups every offered type', async () => {
    const { field } = await render({ form: [{ key: 'title', type: 'string' }] });
    const options = child(field.fieldGroup![0], 'type').props!.options as { value: string, label: string, group: string }[];
    const named = typeGroups().flatMap(([, types]) => types.map(([name]) => name));
    expect(options.filter(o => !named.includes(o.value)).map(o => o.value)).toEqual([]);
    expect(options.find(o => o.value === 'string')).toEqual({ value: 'string', label: 'Text', group: 'Text' });
    expect(options.find(o => o.value === 'geometries')!.group).toBe('Map');
  });

  it('shows unknown types by name', () => {
    expect(typeOptions(['string', 'custom'])).toEqual([
      { value: 'string', label: 'Text', group: 'Text' },
      { value: 'custom', label: 'custom', group: 'Other' },
    ]);
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

  it('edits the template only for stencils', async () => {
    const model = { form: [
      { key: 'a', type: 'string' },
      { key: 'car', type: 'stencil', props: { template: 'car/<Make>' } },
    ] };
    const { fixture, field } = await render(model);
    expect(child(field.fieldGroup![0], 'props.template').hide).toBe(true);
    expect(child(field.fieldGroup![0], 'props.hierarchical').hide).toBe(true);
    expect(child(field.fieldGroup![0], 'props.placeholder').hide).toBeFalsy();
    const stencil = field.fieldGroup![1];
    expect(child(stencil, 'props.placeholder').hide).toBe(true);
    expect(child(stencil, 'props.template').hide).toBeFalsy();
    expect(child(stencil, 'props.template').formControl!.value).toBe('car/<Make>');
    child(stencil, 'props.template').formControl!.setValue('car/<Make>/<Model>');
    child(stencil, 'props.hierarchical').formControl!.setValue(true);
    await fixture.whenStable();
    expect(model.form[1].props).toEqual({ template: 'car/<Make>/<Model>', hierarchical: true });
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

  it('keeps hidden options and nested fields when the type changes', async () => {
    const model = { form: [
      { key: 'a', type: 'select', props: { options: [{ value: 'x', label: 'X' }] } },
      { key: 'b', fieldGroup: [{ key: 'nested', type: 'number' }] },
    ] };
    const { fixture, field } = await render(model);
    child(field.fieldGroup![0], 'type').formControl!.setValue('string');
    child(field.fieldGroup![1], 'type').formControl!.setValue('string');
    await fixture.whenStable();
    expect(model.form[1]).not.toHaveProperty('fieldGroup');
    child(field.fieldGroup![0], 'type').formControl!.setValue('select');
    child(field.fieldGroup![1], 'type').formControl!.setValue(null);
    await fixture.whenStable();
    expect(model.form[0].props!.options).toEqual([{ value: 'x', label: 'X' }]);
    expect(model.form[1].fieldGroup).toEqual([{ key: 'nested', type: 'number' }]);
  });

  it('removes cleared keys and labels', async () => {
    const model = { form: [{ key: 'a', type: 'string', props: { label: 'A:' } }] };
    const { fixture, field } = await render(model);
    child(field.fieldGroup![0], 'key').formControl!.setValue('');
    child(field.fieldGroup![0], 'props.label').formControl!.setValue('');
    await fixture.whenStable();
    expect(JSON.parse(JSON.stringify(model.form[0]))).toEqual({ type: 'string', props: {} });
  });

  function hidden(item: FormlyFieldConfig, ...keys: string[]) {
    return keys.filter(k => !!child(item, k).hide);
  }

  it('hides label, placeholder, hint and required where the type ignores them', async () => {
    const { field } = await render({ form: [
      { key: 'a', type: 'string' },
      { key: 'b', type: 'tags' },
      { key: 'c', type: 'geo-style' },
      { key: 'd', type: 'range' },
      { key: 'e', type: 'duration' },
      { key: 'f', type: 'location' },
      { key: 'g', type: 'code' },
      { key: 'h', type: 'boolean' },
      { key: 'i', type: 'typo' },
      { key: 'j', type: 'geometries' },
      { key: 'k', type: 'userMap' },
    ] });
    const keys = ['props.label', 'props.placeholder', 'props.hint', 'props.required'];
    const [string, tags, geoStyle, range, duration, location, code, checkbox, unknown, geometries, userMap] = field.fieldGroup!;
    expect(hidden(string, ...keys)).toEqual([]);
    expect(hidden(tags, ...keys)).toEqual(['props.placeholder', 'props.hint', 'props.required']);
    expect(hidden(geoStyle, ...keys)).toEqual(keys);
    expect(hidden(range, ...keys)).toEqual(['props.placeholder']);
    expect(hidden(duration, ...keys)).toEqual([]);
    expect(hidden(location, ...keys)).toEqual(['props.placeholder']);
    expect(hidden(code, ...keys)).toEqual(['props.placeholder']);
    expect(hidden(checkbox, ...keys)).toEqual(['props.placeholder']);
    expect(hidden(unknown, ...keys)).toEqual([]);
    expect(hidden(geometries, ...keys)).toEqual(['props.placeholder', 'props.hint', 'props.required']);
    expect(hidden(userMap, ...keys)).toEqual(['props.placeholder', 'props.hint', 'props.required']);
  });

  it('edits props only for the types which use them', async () => {
    const { field } = await render({ form: [
      { key: 'a', type: 'string' },
      { key: 'b', type: 'select' },
      { key: 'c', type: 'enum' },
      { key: 'd', type: 'radio' },
      { key: 'e', type: 'multicheckbox' },
      { key: 'f', type: 'range' },
      { key: 'g', type: 'code' },
      { key: 'h', type: 'textarea' },
      { key: 'i', type: 'tag' },
      { key: 'j', type: 'query' },
      { key: 'k', type: 'plugin' },
    ] });
    const keys = ['props.multiple', 'props.type', 'props.min', 'props.max', 'props.step', 'props.language', 'props.rows', 'props.prefix'];
    const shown = (item: FormlyFieldConfig) => keys.filter(k => !child(item, k).hide);
    expect(field.fieldGroup!.map(shown)).toEqual([
      [],
      ['props.multiple'],
      ['props.multiple'],
      [],
      ['props.type'],
      ['props.min', 'props.max', 'props.step'],
      ['props.language'],
      ['props.rows'],
      ['props.prefix'],
      ['props.prefix'],
      [],
    ]);
  });

  it('saves new props', async () => {
    const model = { form: [
      { key: 'a', type: 'range' },
      { key: 'b', type: 'select' },
    ] };
    const { fixture, field } = await render(model);
    child(field.fieldGroup![0], 'props.min').formControl!.setValue(2);
    child(field.fieldGroup![0], 'props.max').formControl!.setValue(8);
    child(field.fieldGroup![1], 'props.multiple').formControl!.setValue(true);
    await fixture.whenStable();
    expect(model.form[0]).toEqual({ key: 'a', type: 'range', props: { min: 2, max: 8 } });
    expect(model.form[1]).toEqual({ key: 'b', type: 'select', props: { multiple: true } });
    child(field.fieldGroup![0], 'props.max').formControl!.setValue(null);
    await fixture.whenStable();
    expect(JSON.parse(JSON.stringify(model.form[0]))).toEqual({ key: 'a', type: 'range', props: { min: 2 } });
  });

  it('only keeps an array value type while the type is multicheckbox', async () => {
    const model: any = { form: [{ key: 'a', type: 'multicheckbox', props: { type: 'array' } }] };
    const { fixture, field } = await render(model);
    child(field.fieldGroup![0], 'type').formControl!.setValue('string');
    await fixture.whenStable();
    expect(model.form[0].props.type).toBeUndefined();
    child(field.fieldGroup![0], 'type').formControl!.setValue('multicheckbox');
    await fixture.whenStable();
    expect(model.form[0].props.type).toBe('array');
  });
});
