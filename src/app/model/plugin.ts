import * as Handlebars from 'handlebars/runtime';
import { toJS } from 'mobx';
import * as moment from 'moment';
import { v4 as uuid } from 'uuid';
import { Ref } from './ref';
import { Config } from './tag';

export type PluginType = 'core' | 'feature' | 'editor' | 'viewer' | 'semantic' | 'tool';

export interface Plugin extends Config {
  type?: 'plugin';
  config?: Config['config'] & {
    /**
     * Optional category for setup screen.
     */
    type?: PluginType,
    /**
     * Optional handlebars template to use as an info UI.
     */
    infoUi?: string,
    /**
     * Add tags when replying to this plugin.
     */
    reply?: string[],
    /**
     * Add plugin to submit dropdown.
     */
    submit?: string,
    /**
     * Nest this plugin within its parent.
     */
    submitChild?: string,
    /**
     * Add plugin to submit tabs and generate internal URL.
     */
    submitInternal?: string,
    /**
     * Add plugin to submit tabs and use DM UI.
     */
    submitDm?: string,
    /**
     * Add tab on the settings page for this plugin using this label.
     */
    settings?: string,
    /**
     * Add a ribbon to the editor to enable this plugin.
     */
    editor?: string,
    /**
     * List of file extensions that match this plugin.
     */
    extensions?: string[],
    /**
     * List of web hosts that match this plugin.
     */
    hosts?: string[],
    /**
     * List of URL schemes that match this plugin.
     */
    schemes?: string[],
    /**
     * Optionally customise the meaning of the published field.
     */
    published?: string;
  };
  /**
   * Generate separate Ref response metadata for this plugin.
   */
  generateMetadata?: boolean;
  /**
   * Validate that any Ref with this plugin has a valid User URL.
   */
  userUrl?: boolean;

  // Cache
  _ui?: HandlebarsTemplateDelegate;
  _infoUi?: HandlebarsTemplateDelegate;
}

export function mapPlugin(obj: any): Plugin {
  obj.type = 'plugin';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = obj.modified && moment(obj.modified);
  return obj;
}

export function maybePlugin(obj: any): Plugin | undefined {
  if (!obj) return undefined;
  return mapPlugin(obj);
}

export function writePlugin(plugin: Plugin): Plugin {
  const result = { ...plugin };
  result.modified = result.modifiedString as any;
  delete result.type;
  delete result.upload;
  delete result.exists;
  delete result.modifiedString;
  delete result._ui;
  delete result._infoUi;
  return result;
}

// https://github.com/handlebars-lang/handlebars.js/issues/1593
// @ts-ignore
window.global = {};

Handlebars.registerHelper('uuid', prefix => uuid());

Handlebars.registerHelper('fromNow', value => moment(value).fromNow());

Handlebars.registerHelper('response', (ref: Ref, value: string) => {
  return ref.metadata?.userUrls?.includes(value);
});

Handlebars.registerHelper('percent', (ref: Ref, value: string, prefix: string) => {
  if (!ref?.metadata?.plugins) return 0;
  let total = 0;
  for (const k in ref.metadata.plugins) {
    if (k.startsWith(prefix)) {
      total += ref.metadata.plugins[k] || 0;
    }
  }
  if (!total) return 0;
  return Math.floor(100 * (ref.metadata.plugins[prefix + value] || 0) / total);
});

export function renderPlugin(plugin: Plugin, ref: Ref = { url: '' }) {
  if (!plugin.config?.ui) return '';
  if (!plugin._ui) {
    plugin._ui = Handlebars.compile(plugin.config.ui);
  }
  return plugin._ui({
    ref: toJS(ref),
    plugin: toJS(plugin),
    ...toJS(ref.plugins?.[plugin.tag] || {}),
  });
}

export function renderPluginInfo(plugin: Plugin, ref: Ref = { url: '' }) {
  if (!plugin.config?.infoUi) return '';
  if (!plugin._infoUi) {
    plugin._infoUi = Handlebars.compile(plugin.config.infoUi);
  }
  return plugin._infoUi({
    ref: toJS(ref),
    plugin: toJS(plugin),
    ...toJS(ref.plugins?.[plugin.tag] || {}),
  });
}
