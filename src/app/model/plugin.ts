import * as Handlebars from 'handlebars';
import { toJS } from 'mobx';
import * as moment from 'moment';
import { hasTag } from '../util/tag';
import { Ref } from './ref';
import { Config } from './tag';
import { Role } from './user';

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
     * Add tab on the settings page for this plugin using this label.
     */
    settings?: string,
    /**
     * Add a ribbon to the editor to enable this plugin.
     */
    editor?: string,
    /**
     * Optional icons to add to refs based on tag triggers.
     */
    icons?: Icon[],
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
    /**
     * Add an action to the Ref actions bar.
     */
    actions?: Action[],
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

export interface Visibility {
  /**
   * Minimum role required to be visible.
   */
  role?: Role;
  /**
   * Field name of a config flag to show / hide.
   */
  condition?: string;
  /**
   * If set, limits visibility to the indicated parties.
   */
  visible?: 'author' | 'recipient' | 'participant';
  /**
   * Add this to every Ref, not just Refs with this plugin.
   */
  global?: boolean;
  /**
   * Optional number to influence order relative to other items.
   * Unset or 0 has no impact on ordering.
   * Lower positive numbers will be towards the left or start, higher positive
   * numbers will be towards the right or end.
   * Negative numbers will reverse alignment. i.e. 1 will be first and -1 will
   * be last.
   */
  order?: number;
}

export function visible(v: Visibility, isAuthor: boolean, isRecipient: boolean) {
  if (!v.visible) return true;
  if (isAuthor) return v.visible === 'author' || v.visible === 'participant';
  if (isRecipient) return v.visible === 'recipient' || v.visible === 'participant';
  return false;
}

export function sortOrder<T extends Visibility>(vs: T[]) {
  return vs.sort((a, b) => {
    if (!a.order || !b.order) return (b.order || 0) - (a.order || 0);
    if (Math.sign(a.order) !== Math.sign(b.order)) return b.order - a.order;
    return a.order - b.order;
  });
}

export interface Icon extends Visibility {
  label: string;
  title?: string;
  /**
   * If set, makes this icon conditional on a tag.
   */
  tag?: string;
  /**
   * If set, makes this icon conditional on a tag response.
   */
  response?: `plugin/${string}`;
  /**
   * If set, makes this icon conditional on a ref scheme.
   */
  scheme?: `${string}:`;
}

export type Action = TagAction | ResponseAction | EventAction;

export interface TagAction extends Visibility {
  /**
   * Add a tag directly to the Ref.
   */
  tag: string;
  /**
   * Label to show when this action has been applied.
   */
  labelOn?: string;
  /**
   * Label to show when this action has not been applied.
   */
  labelOff?: string;
}

export interface ResponseAction extends Visibility {
  /**
   * Add a tag response to the Ref.
   */
  response: `plugin/${string}`;
  /**
   * Clear other tag responses when adding tag response.
   */
  clear?: `plugin/${string}`[];
  /**
   * Label to show when this action has been applied.
   * The response plugin must have metadata generation turned on.
   */
  labelOn?: string;
  /**
   * Label to show when this action has not been applied.
   * The response plugin must have metadata generation turned on.
   */
  labelOff?: string;
}

export interface EventAction extends Visibility {
  /**
   * Fire an event when action is triggered.
   */
  event: string;
  /**
   * Event label.
   */
  label?: string;
}

export function active(ref: Ref, o: TagAction | ResponseAction | Icon) {
  if ('scheme' in o) return true;
  if (!('tag' in o || 'response' in o)) return true;
  if (('tag' in o) && hasTag(o.tag, ref)) return true;
  if (('response' in o) && o.response && ref.metadata?.userUrls?.includes(o.response)) return true;
  return false;
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
