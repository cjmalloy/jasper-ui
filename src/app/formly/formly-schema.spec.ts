/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { FormlyConfig, FormlyFieldConfig, FormlyFormBuilder } from '@ngx-formly/core';
import { isValidSchema, validate } from 'jtd';
import {
  formlyDefaults,
  formlySchema,
  generateDefaults,
  generateSchema,
  optionalFields,
  typeChain
} from './formly-schema';
import { provideJasperFormly } from './formly.config';

describe('formly schema', () => {
  let config: FormlyConfig;
  let builder: FormlyFormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideJasperFormly()],
    });
    config = TestBed.inject(FormlyConfig);
    builder = TestBed.inject(FormlyFormBuilder);
  });

  it('follows type extends chains', () => {
    expect(typeChain(config, 'qtags')).toEqual(['qtags', 'tags', 'list']);
    expect(typeChain(config, 'missing')).toEqual([]);
  });

  it('generates schemas for field types', () => {
    const fields: FormlyFieldConfig[] = [
      { key: 'title', type: 'string', props: { required: true } },
      { key: 'count', type: 'integer' },
      { key: 'ratio', type: 'number' },
      { key: 'level', type: 'range' },
      { key: 'done', type: 'boolean' },
      { key: 'tags', type: 'tags' },
      { key: 'pinned', type: 'refs' },
      { key: 'where', type: 'location' },
      { key: 'color', type: 'select', props: { options: [{ value: 'red' }, { value: 'blue' }] } },
      { key: 'cols', type: 'select', props: { options: [{ label: 'Default' }, { value: 1 }, { value: 2 }] } },
      { key: 'big', type: 'select', props: { options: [{ value: 1 }, { value: 4294967296 }] } },
      { key: 'notes', type: 'editor' },
      { key: 'form', type: 'formly' },
    ];
    const schema = formlySchema(config, fields);
    expect(isValidSchema(schema)).toBe(true);
    expect(schema).toEqual({
      properties: {
        title: { type: 'string' },
      },
      optionalProperties: {
        count: { type: 'int32', nullable: true },
        ratio: { type: 'float64', nullable: true },
        level: { type: 'float64' },
        done: { type: 'boolean' },
        tags: { elements: { type: 'string' } },
        pinned: { elements: { type: 'string' } },
        where: { elements: { type: 'float64' } },
        color: { enum: ['red', 'blue'] },
        cols: { type: 'int32' },
        big: { type: 'float64' },
        notes: { type: 'string' },
        form: { elements: {} },
      },
    });
  });

  it('generates schemas for lists of groups, nested groups and dotted keys', () => {
    const fields: FormlyFieldConfig[] = [{
      key: 'filters',
      type: 'list',
      fieldArray: {
        fieldGroup: [
          { key: 'label', type: 'string' },
          { key: 'query', type: 'query', props: { required: true } },
        ],
      },
    }, {
      key: 'offer',
      fieldGroup: [{ key: 'sdp', type: 'textarea' }],
    }, {
      fieldGroup: [{ key: 'flat', type: 'string' }],
    }, {
      key: 'a.b',
      type: 'number',
      props: { required: true },
    }];
    const schema = formlySchema(config, fields);
    expect(isValidSchema(schema)).toBe(true);
    expect(schema).toEqual({
      properties: {
        a: { properties: { b: { type: 'float64' } }, optionalProperties: {} },
      },
      optionalProperties: {
        filters: { elements: {
          properties: { query: { type: 'string' } },
          optionalProperties: { label: { type: 'string' } },
        } },
        offer: { optionalProperties: { sdp: { type: 'string' } } },
        flat: { type: 'string' },
      },
    });
  });

  it('keeps schema metadata and additional properties', () => {
    const schema = formlySchema(config, [{ key: 'title', type: 'string' }], {
      metadata: { note: 'x' },
      additionalProperties: true,
      optionalProperties: { removed: { type: 'string' } },
    });
    expect(schema).toEqual({
      optionalProperties: { title: { type: 'string' } },
      metadata: { note: 'x' },
      additionalProperties: true,
    });
  });

  it('generated schemas validate default values', () => {
    const fields: FormlyFieldConfig[] = [
      { key: 'level', type: 'range' },
      { key: 'where', type: 'location' },
      { key: 'tags', type: 'tags', defaultValue: ['public'] },
    ];
    const schema = formlySchema(config, fields);
    const defaults = formlyDefaults(config, builder, fields);
    expect(defaults).toEqual({ level: 0, where: [0, 0], tags: ['public'] });
    expect(validate(schema, defaults)).toEqual([]);
  });

  it('keeps existing defaults for fields in the form', () => {
    const fields: FormlyFieldConfig[] = [
      { key: 'level', type: 'range' },
      { key: 'title', type: 'string', defaultValue: 'new' },
    ];
    const defaults = formlyDefaults(config, builder, fields, { level: 5, removed: true });
    expect(defaults).toEqual({ level: 5, title: 'new' });
  });

  it('makes every renderable field optional for editing defaults', () => {
    const fields = optionalFields(config, [
      { key: 'title', type: 'string', props: { required: true } },
      { key: 'typo', type: 'strnig' },
      { key: 'items', type: 'list' },
      { key: 'tags', type: 'tags' },
    ]);
    expect(fields.map(f => f.key)).toEqual(['title', 'tags']);
    expect(fields[0].props!.required).toBe(false);
  });

  it('only clears required in field props', () => {
    const fields = optionalFields(config, [
      { key: 'group', defaultValue: { required: true }, props: { required: true }, fieldGroup: [
        { key: 'required', type: 'boolean', defaultValue: true, props: { required: true } },
      ] },
    ]);
    expect(fields[0].defaultValue).toEqual({ required: true });
    expect(fields[0].props!.required).toBe(false);
    expect(fields[0].fieldGroup![0].defaultValue).toBe(true);
    expect(fields[0].fieldGroup![0].props!.required).toBe(false);
  });

  it('keeps null select options in the schema', () => {
    const schema = formlySchema(config, [
      { key: 'color', type: 'select', props: { options: [{ value: 'red' }, { value: null, label: 'None' }] } },
    ]);
    expect(schema).toEqual({ optionalProperties: { color: { enum: ['red'], nullable: true } } });
    expect(validate(schema as any, { color: null })).toEqual([]);
  });

  it('updates the schema and defaults controls from the config control', () => {
    const group = new FormGroup({
      config: new FormControl(JSON.stringify({
        form: [null, { key: 'title', type: 'string', defaultValue: 'hi' }, { fieldGroup: [null] }],
        advancedForm: [{ key: 'count', type: 'integer' }, { key: 'color', type: 'select', props: { options: [null, { value: 'red' }] } }],
      })),
      schema: new FormControl<string | null>(null),
      defaults: new FormControl<string | null>(null),
    });
    generateSchema(config, group);
    generateDefaults(config, builder, group);
    expect(JSON.parse(group.value.schema!)).toEqual({
      optionalProperties: { title: { type: 'string' }, count: { type: 'int32', nullable: true }, color: { enum: ['red'] } },
    });
    expect(JSON.parse(group.value.defaults!)).toEqual({ title: 'hi' });
    expect(group.get('schema')!.dirty).toBe(true);
  });

  it('allows null for optional fields which can be cleared', () => {
    const schema = formlySchema(config, [
      { key: 'width', type: 'integer' },
      { key: 'height', type: 'integer', props: { required: true } },
      { key: 'accent', type: 'color' },
      { key: 'level', type: 'range' },
    ]);
    expect(schema).toEqual({
      properties: { height: { type: 'int32' } },
      optionalProperties: {
        width: { type: 'int32', nullable: true },
        accent: { type: 'string', nullable: true },
        level: { type: 'float64' },
      },
    });
    expect(validate(schema, { height: 1, width: null, accent: null })).toEqual([]);
  });

  it('merges keyed groups which appear more than once', () => {
    const fields = [
      { key: 'settings', fieldGroup: [{ key: 'a', type: 'string' }] },
      { key: 'settings', fieldGroup: [{ key: 'b', type: 'string', props: { required: true } }] },
    ];
    expect(formlySchema(config, fields)).toEqual({
      properties: {
        settings: {
          properties: { b: { type: 'string' } },
          optionalProperties: { a: { type: 'string' } },
        },
      },
    });
  });

  it('removes nested defaults for deleted fields', () => {
    const fields: FormlyFieldConfig[] = [
      { key: 'profile', fieldGroup: [{ key: 'name', type: 'string' }] },
      { key: 'rows', type: 'list', fieldArray: { fieldGroup: [{ key: 'label', type: 'string' }] } },
    ];
    const defaults = formlyDefaults(config, builder, fields, {
      profile: { name: 'Alice', retired: true },
      rows: [{ label: 'a', old: 1 }],
      gone: 1,
    });
    expect(defaults).toEqual({ profile: { name: 'Alice' }, rows: [{ label: 'a' }] });
    expect(validate(formlySchema(config, fields), defaults)).toEqual([]);
  });
});
