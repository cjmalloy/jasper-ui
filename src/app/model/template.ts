import { FormlyFieldConfig } from '@ngx-formly/core';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { Schema } from 'jtd';
import * as moment from 'moment';
import { Ext } from './ext';
import { Tag } from './tag';

export type TemplateType = 'core' | 'feature' | 'tool';

export interface Template extends Tag {
  type?: 'template';
  config?: {
    /**
     * Templates may only be created and edited by admin, so we allow anything.
     * Schemas are only used on non-admin config.
     */
    [record: string]: any,
    /**
     * Optional category for setup screen.
     */
    type?: TemplateType,
    /**
     * Install by default on a fresh instance.
     */
    default?: boolean;
    /**
     * Mark this template as an experiment. Only show on setup page if
     * plugin/experiments is installed.
     */
    experimental?: boolean;
    /**
     * Description of what this template is used for.
     */
    description?: string,
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
  /**
   * Default config values when validating or reading. Should pass validation.
   */
  defaults?: any;
  /**
   * JTD schema for validating config.
   */
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
  if (result.modifiedString) result.modified = result.modifiedString as any;
  delete result.type;
  delete result.modifiedString;
  delete result._ui;
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
