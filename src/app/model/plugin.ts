import { FormlyFieldConfig } from '@ngx-formly/core';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { Schema } from 'jtd';
import * as moment from 'moment';
import { hasTag } from '../util/tag';
import { Ref } from './ref';
import { Tag } from './tag';

export interface Plugin extends Tag {
  type?: 'plugin';
  config?: {
    /**
     * Plugins may only be created and edited by admin, so we allow anything.
     * Schemas are only used on non-admin config.
     */
    [record: string]: any,
    /**
     * Optional category for setup screen.
     */
    type?: 'feature' | 'editor' | 'viewer' | 'semantic' | 'theme',
    /**
     * Install by default on a fresh instance.
     */
    default?: boolean;
    /**
     * Description of what this plugin is used for.
     */
    description?: string,
    /**
     * Optional handlebars template to use as an embed UI.
     */
    ui?: string,
    /**
     * Optional CSS to be added to <head> on load.
     */
    css?: string,
    /**
     * Optional formly config for editing a form defined by the schema.
     */
    form?: FormlyFieldConfig[],
    /**
     * Add plugin to submit dropdown.
     */
    submit?: string,
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
     * Add an action to the Ref actions bar that toggles a tag or tag response.
     */
    actions?: Action[],
    /**
     * Add query or response filters to the filter dropdown.
     */
    filters?: PluginFilter[],
    /**
     * Optional default read access tags to give users. Tags will be prefixed
     * with the plugin tag.
     */
    readAccess?: string[],
    /**
     * Optional default write access tags to give users. Tags will be prefixed
     * with the plugin tag.
     */
    writeAccess?: string[],
  };
  /**
   * Default config values when validating or reading. Should pass validation.
   */
  defaults?: any;
  /**
   * JTD schema for validating config.
   */
  schema?: Schema;
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
}

export interface Visibility {
  /**
   * If set, limits visibility to the indicated parties.
   */
  visible?: 'author' | 'recipient' | 'participant';
}

export function visible(v: Visibility, isAuthor: boolean, isRecipient: boolean) {
  if (!v.visible) return true;
  if (isAuthor) return v.visible === 'author' || v.visible === 'participant';
  if (isRecipient) return v.visible === 'recipient' || v.visible === 'participant';
  return false;
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
}

export interface Action extends Visibility {
  /**
   * Add a tag directly to the Ref.
   * If set, response must not be set.
   */
  tag?: string;
  /**
   * Add a tag response to the Ref.
   * If set, tag must not be set.
   */
  response?: `plugin/${string}`;
  /**
   * Clear other tag responses when adding tag response.
   * If set, tag must not be set.
   */
  clear?: `plugin/${string}`[];
  /**
   * Label to show when this action has been applied. In the case of response
   * actions, the response plugin must have metadata generation turned on.
   */
  labelOn?: string;
  /**
   * Label to show when this action has not been applied. In the case of response
   * actions, the response plugin must have metadata generation turned on.
   */
  labelOff?: string;
  /**
   * If set, limits visibility to the indicated parties.
   */
  visible?: 'author' | 'recipient' | 'participant';
}

export function active(ref: Ref, o: Action | Icon) {
  if (!o.tag && !o.response) return true;
  if (o.tag && hasTag(o.tag, ref)) return true;
  if (o.response && ref.metadata?.plugins?.[o.response]) return true;
  return false;
}

export interface PluginFilter {
  /**
   * Filter based on a tag query.
   * If set, response must not be set.
   */
  query?: string;
  /**
   * Filter based on plugin responses in metadata. Plugins must have be
   * generating metadata to work.
   * If set, query must not be set.
   */
  response?: `plugin/${string}` | `-plugin/${string}`;
  label?: string;
  group?: string;
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
  delete result._ui;
  return result;
}

export function renderPlugin(plugin: Plugin, ref: Ref = { url: '' }) {
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
