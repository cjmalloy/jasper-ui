import { FormlyFieldConfig } from '@ngx-formly/core';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { Schema } from 'jtd';
import * as moment from 'moment';
import { Ref } from './ref';
import { Tag } from './tag';

export interface Plugin extends Tag {
  type?: 'plugin';
  config?: {
    [record: string]: any,
    /**
     * Optional handlebars template to use as an embed UI.
     */
    ui?: string,
    /**
     * Optional formly config for editing a form defined by the schema.
     */
    form?: FormlyFieldConfig[],
    /**
     * Add tab on submit page for this plugin using this label.
     */
    submit?: string,
    description?: string,
    /**
     * Add an action to the Ref actions bar that toggles a tag.
     */
    actions?: Action[],
    /**
     * Add query or response filters to the filter dropdown.
     */
    filters?: PluginFilter[],
  };
  defaults?: any;
  schema?: Schema;
  generateMetadata?: boolean;

  // Cache
  _ui?: HandlebarsTemplateDelegate;
}

export interface Action {
  tag: string,
  labelOn?: string,
  labelOff?: string,
}

export interface PluginFilter {
  query?: string,
  response?: `plugin/${string}` | `-plugin/${string}`,
  label?: string,
  group?: string,
}

export function mapPlugin(obj: any): Plugin {
  obj.type = 'plugin';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = moment(obj.modified);
  return obj;
}

export function maybePlugin(obj: any): Plugin | undefined {
  if (!obj) return undefined;
  return mapPlugin(obj);
}

export function writePlugin(plugin: Partial<Plugin>): Partial<Plugin> {
  const result = { ...plugin };
  result.modified = result.modifiedString as any;
  delete result.type;
  delete result.modifiedString;
  return result;
}

export function renderPlugin(plugin: Plugin, ref: Ref) {
  if (!plugin.config?.ui) return '';
  if (!plugin._ui) {
    plugin._ui = Handlebars.compile(plugin.config.ui);
  }
  return plugin._ui({
    ref,
    plugin,
    ...(ref.plugins?.[plugin.tag] || {}),
  });
}
