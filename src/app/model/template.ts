import { FormlyFieldConfig } from '@ngx-formly/core';
import * as Handlebars from 'handlebars';
import { Schema } from 'jtd';
import * as moment from 'moment';
import { Ext } from './ext';
import { Tag } from './tag';

export interface Template extends Tag {
  type?: 'template';
  config?: {
    [record: string]: any,
    /**
     * Optional handlebars template to use as a sidebar UI.
     */
    ui?: string,
    /**
     * Do not render UIs from inherited Templates. If unset UIs
     * will stack from abstract to specific inheritance.
     */
    overrideUi?: boolean;
    /**
     * Optional formly config for editing a form defined by the schema.
     */
    form?: FormlyFieldConfig[],
    /**
     * Do not render forms from inherited Templates. If unset forms
     * will stack from abstract to specific inheritance.
     */
    overrideForm?: boolean;
  };
  defaults?: any;
  schema?: Schema;

  // Cache
  _ui?: HandlebarsTemplateDelegate;
}

export function mapTemplate(obj: any): Template {
  obj.type = 'template';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = moment(obj.modified);
  return obj;
}

export function maybeTemplate(obj: any): Template | undefined {
  if (!obj) return undefined;
  return mapTemplate(obj);
}

export function writeTemplate(template: Partial<Template>): Partial<Template> {
  const result = { ...template };
  result.modified = result.modifiedString as any;
  delete result.type;
  delete result.modifiedString;
  return result;
}

export function renderTemplates(templates: Template[], ext: Ext) {
  return templates.map(t => renderTemplate(t, ext)).join();
}

export function renderTemplate(template: Template, ext: Ext) {
  if (!template.config?.ui) return '';
  if (!template._ui) {
    template._ui = Handlebars.compile(template.config.ui);
  }
  return template._ui({
    ext,
    template,
    ...(ext.config || {}),
  });
}
