import { AbstractControl, FormGroup } from '@angular/forms';
import { FormlyConfig, FormlyFieldConfig, FormlyFormBuilder } from '@ngx-formly/core';
import { Schema } from 'jtd';
import { cloneDeep, cloneDeepWith, defaultsDeep, isObject, isPlainObject } from 'lodash-es';

type ObjectSchema = { properties?: Record<string, Schema>, optionalProperties?: Record<string, Schema> };

/**
 * Names of the field type and every type it extends, most specific first.
 */
export function typeChain(config: FormlyConfig, type?: string): string[] {
  const chain: string[] = [];
  for (let t = type; t && !chain.includes(t); t = config.getType(t)?.extends) {
    if (!config.getType(t)) break;
    chain.push(t);
  }
  return chain;
}

/**
 * Field config merged with the default options of its type and every type it extends.
 */
export function mergedField(config: FormlyConfig, field: FormlyFieldConfig): FormlyFieldConfig {
  const merged = cloneDeep(field);
  for (const t of typeChain(config, field.type as string)) {
    const defaults = config.getType(t)?.defaultOptions;
    if (defaults) defaultsDeep(merged, cloneDeep(defaults));
  }
  return merged;
}

function optionsSchema(options: any): Schema {
  if (!Array.isArray(options)) return {};
  const values = options.map(o => o?.value).filter(v => v !== undefined && v !== null);
  if (!values.length) return {};
  if (values.every(v => typeof v === 'string')) return { enum: [...new Set(values)] };
  if (values.every(v => Number.isInteger(v))) return { type: 'int32' };
  if (values.every(v => typeof v === 'number')) return { type: 'float64' };
  if (values.every(v => typeof v === 'boolean')) return { type: 'boolean' };
  return {};
}

/**
 * JTD schema for the value of a single field, ignoring its key.
 */
function fieldSchema(config: FormlyConfig, field: FormlyFieldConfig): Schema {
  const merged = mergedField(config, field);
  const chain = typeChain(config, merged.type as string);
  const props: any = merged.props || {};
  if (chain.includes('formly')) return { elements: {} };
  if (merged.fieldArray) {
    return { elements: fieldSchema(config, merged.fieldArray as FormlyFieldConfig) };
  }
  if (!merged.type && merged.fieldGroup) return groupSchema(config, merged.fieldGroup);
  if (chain.includes('integer')) return { type: 'int32' };
  if (chain.includes('number') || chain.includes('range')) return { type: 'float64' };
  if (chain.includes('checkbox')) return { type: 'boolean' };
  if (chain.includes('location') || chain.includes('bbox')) return { elements: { type: 'float64' } };
  if (chain.includes('multicheckbox')) {
    const option = optionsSchema(props.options);
    return props.type === 'array' ? { elements: option } : { values: { type: 'boolean' } };
  }
  if (chain.includes('select') || chain.includes('radio')) {
    const option = optionsSchema(props.options);
    return props.multiple ? { elements: option } : option;
  }
  if (chain.includes('input') && props.type === 'number') return { type: 'float64' };
  if (['duration', 'child-plugin', 'geometries', 'geo-style'].some(t => chain.includes(t))) return {};
  if (!chain.length) return {};
  return { type: 'string' };
}

function isRequired(field: FormlyFieldConfig): boolean {
  if (field.props?.required) return true;
  return !field.type && !!field.fieldGroup?.some(f => isRequired(f));
}

function addProperty(schema: ObjectSchema, path: string[], value: Schema, required: boolean) {
  const [key, ...rest] = path;
  const prop = required ? 'properties' : 'optionalProperties';
  const other = required ? 'optionalProperties' : 'properties';
  if (!rest.length) {
    delete schema[other]?.[key];
    (schema[prop] ||= {})[key] = value;
    return;
  }
  let child = (schema.properties?.[key] || schema.optionalProperties?.[key]) as ObjectSchema | undefined;
  if (!child || !('properties' in child || 'optionalProperties' in child)) child = { optionalProperties: {} };
  addProperty(child, rest, value, required);
  const childRequired = required || !!schema.properties?.[key];
  delete (childRequired ? schema.optionalProperties : schema.properties)?.[key];
  (schema[childRequired ? 'properties' : 'optionalProperties'] ||= {})[key] = child as Schema;
}

function addFields(config: FormlyConfig, schema: ObjectSchema, fields: FormlyFieldConfig[]) {
  for (const field of fields) {
    if (!isObject(field)) continue;
    const key = field.key;
    if (key === undefined || key === null || key === '') {
      if (!field.type && field.fieldGroup) addFields(config, schema, field.fieldGroup);
      continue;
    }
    const path = Array.isArray(key) ? key.map(k => String(k)) : String(key).split('.');
    addProperty(schema, path, fieldSchema(config, field), isRequired(field));
  }
}

function groupSchema(config: FormlyConfig, fields: FormlyFieldConfig[]): Schema {
  const schema: ObjectSchema = {};
  addFields(config, schema, fields);
  if (!schema.properties && !schema.optionalProperties) schema.optionalProperties = {};
  return schema as Schema;
}

/**
 * Generate a JTD schema for the model of a formly form.
 * The metadata and additionalProperties of an existing schema are kept.
 */
export function formlySchema(config: FormlyConfig, fields: FormlyFieldConfig[], existing?: any): Schema {
  const schema: any = groupSchema(config, fields);
  if (isObject(existing)) {
    const { metadata, additionalProperties } = existing as any;
    if (metadata !== undefined) schema.metadata = metadata;
    if (additionalProperties !== undefined) schema.additionalProperties = additionalProperties;
  }
  return schema;
}

/**
 * Generate default values for the model of a formly form.
 * Existing defaults for fields still in the form are kept, and the
 * default values of the fields and their types fill in the rest.
 */
export function formlyDefaults(config: FormlyConfig, builder: FormlyFormBuilder, fields: FormlyFieldConfig[], existing?: any): any {
  const schema = groupSchema(config, fields) as ObjectSchema;
  const keys = new Set([...Object.keys(schema.properties || {}), ...Object.keys(schema.optionalProperties || {})]);
  const model: any = {};
  if (isObject(existing) && !Array.isArray(existing)) {
    for (const [k, v] of Object.entries(existing)) {
      if (keys.has(k)) model[k] = cloneDeep(v);
    }
  }
  builder.build({ form: new FormGroup({}), model, options: {}, fieldGroup: cloneDeep(fields) });
  return JSON.parse(JSON.stringify(model));
}

/**
 * Form fields from a Plugin or Template config which define the model
 * validated by the schema.
 */
export function configFormFields(config: any): FormlyFieldConfig[] {
  if (!isObject(config)) return [];
  const { form, advancedForm } = config as any;
  return validFields([
    ...(Array.isArray(form) ? form : []),
    ...(Array.isArray(advancedForm) ? advancedForm : []),
  ]);
}

/**
 * Remove blank entries, such as new rows in the form builder.
 */
function validFields(fields: any[]): FormlyFieldConfig[] {
  return fields
    .filter(f => isPlainObject(f))
    .map(f => {
      f = { ...f };
      if (Array.isArray(f.fieldGroup)) f.fieldGroup = validFields(f.fieldGroup);
      if (isPlainObject(f.fieldArray)) f.fieldArray = validFields([f.fieldArray])[0];
      if (Array.isArray(f.props?.options)) f.props = { ...f.props, options: f.props.options.filter((o: any) => isPlainObject(o)) };
      return f;
    });
}

/**
 * Copy of form fields with nothing required, for editing default values.
 * Fields which can't be rendered yet, such as unknown types or lists
 * without a field array, are skipped.
 */
export function optionalFields(config: FormlyConfig, fields: FormlyFieldConfig[]): FormlyFieldConfig[] {
  const renderable = (field: FormlyFieldConfig): boolean => {
    if (field.type) {
      if (typeof field.type !== 'string' || !config.getType(field.type)) return false;
      const chain = typeChain(config, field.type);
      if (chain.includes('list') && !chain.includes('formly') && !mergedField(config, field).fieldArray) return false;
    }
    return true;
  };
  const filter = (fields: FormlyFieldConfig[]): FormlyFieldConfig[] => fields
    .filter(renderable)
    .map(f => Array.isArray(f.fieldGroup) ? { ...f, fieldGroup: filter(f.fieldGroup) } : f);
  return cloneDeepWith(filter(fields), (value, key) => key === 'required' ? false : undefined);
}

function parseJson(value: any) {
  if (typeof value !== 'string') return value;
  try {
    return value ? JSON.parse(value) : undefined;
  } catch (e) {
    return undefined;
  }
}

/**
 * Form fields from the config JSON control of a Plugin or Template form.
 */
export function groupFormFields(group: AbstractControl): FormlyFieldConfig[] {
  return configFormFields(parseJson(group.get('config')?.value));
}

/**
 * Replace the schema in a Plugin or Template form with one generated from its form fields.
 */
export function generateSchema(config: FormlyConfig, group: AbstractControl) {
  const control = group.get('schema')!;
  const schema = formlySchema(config, groupFormFields(group), parseJson(control.value));
  control.setValue(JSON.stringify(schema, null, 2));
  control.markAsDirty();
}

/**
 * Update the defaults in a Plugin or Template form from its form fields.
 */
export function generateDefaults(config: FormlyConfig, builder: FormlyFormBuilder, group: AbstractControl) {
  const control = group.get('defaults')!;
  const defaults = formlyDefaults(config, builder, groupFormFields(group), parseJson(control.value));
  control.setValue(JSON.stringify(defaults, null, 2));
  control.markAsDirty();
}
