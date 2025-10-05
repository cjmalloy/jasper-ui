import { FormlyFieldConfig } from '@ngx-formly/core';
import { Schema } from 'jtd';
import { DateTime } from 'luxon';
import { toJS } from 'mobx';
import { Observable } from 'rxjs';
import { Ref, RefUpdates } from './ref';
import { Config, EmitAction } from './tag';

export interface Plugin extends Config {
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
     * Add plugin to submit dropdown.
     */
    submit?: string,
    /**
     * Autogenerate URL when submitting.
     */
    genId?: boolean,
    /**
     * This plugin should be used in combination with the internal tag so it
     * does not show up on the home page or search.
     */
    internal?: boolean,
    /**
     * Add a button to the response buttons in the editor for a new response.
     * If there is only one option, no UI will be shown.
     * If there are two or more options a toggle will be shown in the editor.
     */
    responseButton?: string,
    /**
     * Add a DM tab to the submit page to create a DM to this tag.
     */
    submitDm?: boolean,
    /**
     * Add plugin to text dropdown.
     */
    submitText?: boolean,
    /**
     * Nest this plugin within its parent.
     */
    submitChild?: string,
    /**
     * Add tab on the inbox page for this plugin using this label.
     */
    inbox?: string,
    /**
     * Add tab on the settings page for this plugin using this label.
     */
    settings?: string,
    /**
     * Disable the editor and use the viewer to edit.
     */
    editingViewer?: boolean;
    /**
     * This plugin can be exported to a self-contained html file.
     */
    export?: boolean,
    /**
     * Show plugin as signature for existing tag.
     */
    signature?: string,
    /**
     * Copy this plugin into responses.
     */
    inherit?: boolean,
    /**
     * List of file extensions that match this plugin.
     */
    extensions?: string[],
    /**
     * List of url prefixes that match this plugin.
     */
    prefix?: string[],
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
     * Require user to confirm resetting defaults with this message.
     */
    defaultsConfirm?: string;
    /**
     * Label for clear cache button. Set this if clear cache method available.
     * Should respond to the event `${tag}:clear-cache`.
     */
    hasClearCache?: string;
    /**
     * Require user to confirm clearing the cache with this message.
     */
    clearCacheConfirm?: string;
    /**
     * Optional formly config for editing a form defined by the schema in bulk tools.
     *
     * Set to true to reuse the existing form.
     */
    bulkForm?: FormlyFieldConfig[] | true,
    /**
     * Optional list of formly configs for editing sub-tags.
     * Each element in the array is an editor for all appearances of tags starting with this plugin.
     * tagForm[0] will be the first sub-tag (split on '/') after the plugin tag itself.
     */
    tagForm?: (FormlyFieldConfig|string)[],
  };
  // Client-only
  type?: 'plugin';
}

export const pluginSchema: Schema = {
  optionalProperties: {
    tag: { type: 'string' },
    name: { type: 'string' },
    config: {},
    defaults: {},
    schema: {},
  }
};

export interface PluginApi {
  comment: (comment: string) => void;
  event: (event: string) => void;
  emit: (a: EmitAction) => void;
  tag: (tag: string) => void;
  respond: (response: string, clear?: string[]) => void;
  watch: () => { ref$: Observable<RefUpdates>, comment$: (comment: string) => Observable<string> },
  append: () => { updates$: Observable<string>, append$: (value: string) => Observable<string> },
}

export function mapPlugin(obj: any): Plugin {
  obj.type = 'plugin';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified &&= DateTime.fromISO(obj.modified);
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
  delete result.outdated;
  delete result.modifiedString;
  delete result.config?._cache;
  return result;
}

export interface PluginScope {
  [record: string]: any,
  ref: Ref;
  plugin: Plugin;
}

export function getPluginScope(plugin?: Config, ref: Ref = { url: '' }, el?: Element, actions?: PluginApi): PluginScope {
  return {
    el,
    actions,
    ref: toJS(ref),
    plugin: toJS(plugin),
    ...toJS(plugin && ref.plugins?.[plugin.tag || ''] || {}),
  };
}
