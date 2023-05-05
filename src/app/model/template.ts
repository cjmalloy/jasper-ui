import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import * as moment from 'moment';
import { Ext } from './ext';
import { Config } from './tag';

export type TemplateType = 'core' | 'feature' | 'theme' | 'tool';

export interface Template extends Config {
  type?: 'template';
  config?: Config['config'] & {
    /**
     * Optional category for setup screen.
     */
    type?: TemplateType,
    /**
     * Do not render forms from inherited Templates. If unset forms
     * will stack from abstract to specific inheritance.
     */
    overrideForm?: boolean;
  };

  // Cache
  _ui?: HandlebarsTemplateDelegate;
}

export function mapTemplate(obj: any): Template {
  obj.type = 'template';
  obj.tag ||= '';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = obj.modified && moment(obj.modified);
  return obj;
}

export function maybeTemplate(obj: any): Template | undefined {
  if (!obj) return undefined;
  return mapTemplate(obj);
}

export function writeTemplate(template: Template): Template {
  const result = { ...template };
  if (result.modifiedString) result.modified = result.modifiedString as any;
  delete result.type;
  delete result.upload;
  delete result.exists;
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
