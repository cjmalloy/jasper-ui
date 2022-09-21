import * as Handlebars from 'handlebars';
import { Schema } from 'jtd';
import * as moment from 'moment';
import { Ref } from './ref';
import { Tag } from './tag';

export interface Plugin extends Tag {
  type?: 'plugin';
  config?: any;
  defaults?: any;
  schema?: Schema;
  generateMetadata?: boolean;

  // Cache
  _ui?: HandlebarsTemplateDelegate;
}

export function mapPlugin(obj: any): Plugin {
  obj.type = 'plugin';
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
  if (!plugin.config.ui) return '';
  if (!plugin._ui) {
    plugin._ui = Handlebars.compile(plugin.config.ui);
  }
  return plugin._ui({
    ref,
    plugin,
    ...(ref.plugins?.[plugin.tag] || {}),
  });
}
