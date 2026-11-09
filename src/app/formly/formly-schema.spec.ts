/// <reference types="vitest/globals" />
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';
import { FormlyConfig, FormlyFieldConfig, FormlyFormBuilder } from '@ngx-formly/core';
import { isValidSchema, validate } from 'jtd';
import { get } from 'lodash-es';
import { AdminService } from '../service/admin.service';
import {
  formlyDefaults,
  formlySchema,
  generateDefaults,
  generateSchema,
  optionalFields,
  typeChain
} from './formly-schema';
import { geoFeaturesSchema, geoStyleSchema } from '../util/geo-style';
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
    expect(defaults).toEqual({ level: 0, tags: ['public'] });
    expect(validate(schema, defaults)).toEqual([]);
  });

  it('defaults a range to its min', () => {
    const fields: FormlyFieldConfig[] = [
      { key: 'level', type: 'range', props: { min: 2, max: 8 } },
      { key: 'zoom', type: 'range', defaultValue: 5, props: { min: 2 } },
    ];
    expect(formlyDefaults(config, builder, fields)).toEqual({ level: 2, zoom: 5 });
  });

  it('has no default location', () => {
    const fields: FormlyFieldConfig[] = [
      { key: 'where', type: 'location' },
      { key: 'home', type: 'location', defaultValue: [0, 0] },
    ];
    const defaults = formlyDefaults(config, builder, fields);
    expect(defaults).toEqual({ home: [0, 0] });
    expect(validate(formlySchema(config, fields), defaults)).toEqual([]);
  });

  it('is a string for a duration', () => {
    const schema = formlySchema(config, [
      { key: 'every', type: 'duration' },
      { key: 'timeout', type: 'duration', props: { required: true } },
    ]);
    expect(schema).toEqual({
      properties: { timeout: { type: 'string' } },
      optionalProperties: { every: { type: 'string', nullable: true } },
    });
    expect(validate(schema, { timeout: 'PT1M', every: null })).toEqual([]);
    expect(validate(schema, { timeout: 60 })).not.toEqual([]);
  });

  it('uses the map schemas for geo styles and geometries', () => {
    const schema = formlySchema(config, [
      { key: 'style', type: 'geo-style' },
      { key: 'features', type: 'geometries' },
    ]) as any;
    expect(isValidSchema(schema)).toBe(true);
    expect(schema.optionalProperties.style).toEqual(geoStyleSchema);
    expect(schema.optionalProperties.features).toEqual(geoFeaturesSchema);
    expect(validate(schema, {
      style: { color: '#ff0000', strokeWidth: 'small', name: 'x' },
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } }],
    })).toEqual([]);
    expect(validate(schema, { style: { strokeWidth: 'heavy' } })).not.toEqual([]);
    expect(validate(schema, { features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: 'here' } }] })).not.toEqual([]);
  });

  it('is only a list of values for a multiple select', () => {
    const options = [{ value: 'a' }, { value: 'b' }];
    expect(formlySchema(config, [
      { key: 'many', type: 'select', props: { multiple: true, options } },
      { key: 'one', type: 'radio', props: { multiple: true, options } },
    ])).toEqual({
      optionalProperties: {
        many: { elements: { enum: ['a', 'b'] } },
        one: { enum: ['a', 'b'] },
      },
    });
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
      { key: 'tag', type: 'stencil' },
    ]);
    expect(schema).toEqual({
      properties: { height: { type: 'int32' } },
      optionalProperties: {
        width: { type: 'int32', nullable: true },
        accent: { type: 'string', nullable: true },
        level: { type: 'float64' },
        tag: { type: 'string', nullable: true },
      },
    });
    expect(validate(schema, { height: 1, width: null, accent: null, tag: null })).toEqual([]);
  });

  it('is a list of tags for a hierarchical stencil', () => {
    expect(formlySchema(config, [
      { key: 'car', type: 'stencil', props: { template: 'car/<Make>/<Model>', hierarchical: true } },
    ])).toEqual({
      optionalProperties: { car: { elements: { type: 'string' }, nullable: true } },
    });
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

describe('formly schema for built-in mods', () => {
  const tightened = ['duration', 'geo-style', 'geometries'];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideJasperFormly(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
  });

  function* walk(config: FormlyConfig, fields: FormlyFieldConfig[] | undefined, value: any): Generator<[FormlyFieldConfig, any]> {
    for (const f of fields || []) {
      if (!f) continue;
      const v = f.key ? get(value, f.key as string) : value;
      if (!f.type && f.fieldGroup) {
        yield* walk(config, f.fieldGroup, v);
      } else if (typeChain(config, f.type as string).some(t => tightened.includes(t)) && f.key && v !== undefined) {
        yield [f, v];
      }
    }
  }

  it('accepts the defaults of every built-in mod', () => {
    TestBed.inject(FormlyFormBuilder);
    const config = TestBed.inject(FormlyConfig);
    const admin = TestBed.inject(AdminService);
    let checked = 0;
    for (const mod of admin.mods) {
      for (const def of [...mod.plugin || [], ...mod.template || []]) {
        const fields = [...def.config?.form || [], ...def.config?.advancedForm || []];
        for (const [field, value] of walk(config, fields, def.defaults)) {
          const schema = formlySchema(config, [{ ...field, key: 'value' }]);
          expect(validate(schema as any, { value }), `${def.tag} ${field.key}`).toEqual([]);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
