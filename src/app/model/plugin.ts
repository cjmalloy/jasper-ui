import { toJS } from 'mobx';
import * as moment from 'moment';
import { Ref } from './ref';
import { Config } from './tag';

export interface Plugin extends Config {
  type?: 'plugin';
  config?: Config['config'] & {
    /**
     * Optional flag adding this plugin to the Ref form Add Plugin dropdown.
     */
    add?: boolean,
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
     * Autogenerate URL when submitting.
     */
    genId?: boolean,
    /**
     * This plugin should be used in combination with the internal tag so it
     * does not show up on the home page or search. Also removes !internal
     * filter when filtering on this plugin.
     */
    internal?: boolean,
    /**
     * Add a DM tab to the submit page to create a DM to this tag, with
     * submitDm as the title of the message.
     */
    submitDm?: string,
    /**
     * Add plugin to text dropdown.
     */
    submitText?: boolean,
    /**
     * Nest this plugin within its parent.
     */
    submitChild?: string,
    /**
     * Add tab on the settings page for this plugin using this label.
     */
    settings?: string,
    /**
     * Add a ribbon to the editor to enable this plugin.
     */
    editor?: string,
    /**
     * Disable the editor and use the viewer to edit.
     */
    editingViewer?: boolean;
    /**
     * Show plugin as signature for existing tag.
     */
    signature?: string,
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
     * Has built in defaults available. Should respond to the event `${tag}:defaults`.
     */
    hasDefaults?: boolean;
    /**
     * Label for clear cache button. Set this if clear cache method available.
     * Should respond to the event `${tag}:clear-cache`.
     */
    hasClearCache?: string;
  };
  /**
   * Generate separate Ref response metadata for this plugin.
   */
  generateMetadata?: boolean;
  /**
   * Validate that any Ref with this plugin has a valid User URL.
   */
  userUrl?: boolean;
}

export function mapPlugin(obj: any): Plugin {
  obj.type = 'plugin';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified &&= moment(obj.modified);
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
  delete result.config?._cache;
  return result;
}

export interface PluginScope {
  [record: string]: any,
  ref: Ref;
  plugin: Plugin;
}

export function getPluginScope(plugin?: Config, ref: Ref = { url: '' }): PluginScope {
  return {
    ref: toJS(ref),
    plugin: toJS(plugin),
    ...toJS(plugin && ref.plugins?.[plugin.tag || ''] || {}),
  };
}
