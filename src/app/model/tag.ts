import { FormlyFieldConfig } from '@ngx-formly/core';
import * as d3 from 'd3';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { Schema } from 'jtd';
import { defer, isEqual, omitBy, uniqWith } from 'lodash-es';
import { DateTime, Duration } from 'luxon';
import { toJS } from 'mobx';
import { v4 as uuid } from 'uuid';
import { interestingTags } from '../util/format';
import { hasAnyResponse, hasResponse, hasTag, prefix } from '../util/tag';
import { filterModels } from '../util/zip';
import { Ext, extSchema } from './ext';
import { Plugin, pluginSchema } from './plugin';
import { Ref, refSchema } from './ref';
import { Template, templateSchema } from './template';
import { Role, User, userSchema } from './user';

export interface Cursor {
  origin?: string;
  modified?: DateTime;
  // Saved to pass modified check since moment looses precision
  // TODO: Does luxon loose precision?
  modifiedString?: string;
  // Client-only
  upload?: boolean;
  exists?: boolean;
  outdated?: boolean;
}

export interface Tag extends Cursor {
  type?: 'ext' | 'user' | 'plugin' | 'template';
  tag: string;
  name?: string;
}

export interface Mod {
  ref?: Ref[];
  ext?: Ext[];
  user?: User[];
  plugin?: Plugin[];
  template?: Template[];
}

export function bundleSize(mod: Mod) {
  return (mod.ref?.length || 0) +
    (mod.ext?.length || 0) +
    (mod.user?.length || 0) +
    (mod.plugin?.length || 0) +
    (mod.template?.length || 0);
}

export const modSchema: Schema = {
  optionalProperties: {
    ref: { elements: refSchema },
    ext: { elements: extSchema },
    user: { elements: userSchema },
    plugin: { elements: pluginSchema },
    template: { elements: templateSchema },
  }
};

export type ModType = 'config' | 'icon' | 'feature' | 'lens' | 'plugin' | 'editor' | 'semantic' | 'theme' | 'tool';

export interface Config extends Tag {
  config?: {
    /**
     * Configs may only be created and edited by admin, so we allow anything.
     * Schemas are only used on non-admin config.
     */
    [record: string]: any,
    /**
     * Optional label which can be used to group plugins and templates.
     */
    mod?: string;
    /**
     * Optional category for setup screen.
     */
    type?: ModType,
    /**
     * Increment-only number to indicate version.
     */
    version?: number;
    /**
     * Flag for disabling a config without deleting.
     */
    disabled?: boolean;
    /**
     * Disable update checking.
     */
    noUpdate?: boolean;
    /**
     * Install by default on a fresh instance.
     */
    default?: boolean;
    /**
     * Mark this as an experiment. Only show on setup page if
     * plugin/experiments is installed.
     */
    experimental?: boolean;
    /**
     * Description of what this is used for.
     */
    description?: string,
    /**
     * Snippet added to the AI system prompt.
     */
    aiInstructions?: string,
    /**
     * Add tags when replying to this tag.
     */
    reply?: string[],
    /**
     * Optional handlebars template to use as a UI.
     */
    ui?: string,
    /**
     * Optional CSS to be added to <head> on load.
     */
    css?: string,
    /**
     * Optional script to be added to <head> on load.
     */
    snippet?: string,
    /**
     * Optional html to be added to <body> on load.
     */
    banner?: string,
    /**
     * Optional html to be added to <body> on load.
     */
    consent?: { [key: string]: string },
    /**
     * Optional buttons to add to the editor.
     */
    editorButtons?: EditorButton[],
    /**
     * Optional formly config for editing a form defined by the schema.
     */
    form?: FormlyFieldConfig[],
    /**
     * Extra formly config to hide in advanced tab.
     */
    advancedForm?: FormlyFieldConfig[],
    /**
     * Optional icons to add to refs based on tag triggers.
     */
    icons?: Icon[],
    /**
     * Add query or response filters to the filter dropdown.
     */
    filters?: FilterConfig[],
    /**
     * Add an action to the Ref actions bar.
     */
    actions?: Action[],
    /**
     * Add an action to the Ref actions overflow bar.
     */
    advancedActions?: Action[],
    /**
     * Add themes.
     */
    themes?: Record<string, string>,
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
  // Client-only
  type?: 'plugin' | 'template';
  /**
   * Cache for compiled templates.
   */
  _cache?: any;
}


export function condition(value: string | undefined, config: any | undefined) {
  if (!value) return false;
  if (value.startsWith('!')) {
    return !config?.[value.substring(1)]
  } else {
    return config?.[value];
  }
}

export interface Visibility {
  /**
   * Optional handlebars template tooltip.
   */
  title?: string;
  /**
   * Tag to show / hide.
   */
  if?: string;
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
   * Add this to every Ref, not just Refs with this tag.
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

  //cache
  _parent?: Config;
}

export function visible(ref: Ref, v: Visibility, isAuthor: boolean, isRecipient: boolean) {
  if (('if' in v) && !hasTag(v.if, ref)) return false;
  if (!v.visible) return true;
  if (isAuthor) return v.visible === 'author' || v.visible === 'participant';
  if (isRecipient) return v.visible === 'recipient' || v.visible === 'participant';
  return false;
}

export function sortOrder<T extends { order?: number, toggle?: string, _parent?: Config; }>(vs: T[]) {
  const getTag = (o: T) => o.toggle || o._parent?.tag || '';
  return vs.sort((a, b) => a.order === b.order ? getTag(b).localeCompare(getTag(a)) : (b.order || 0) - (a.order || 0));
}

export function uniqueConfigs<T extends Visibility>(vs: T[]) {
  const hiddenField = (v: string, k: string) => k.startsWith('_');
  return uniqWith(vs, (a, b) => isEqual(omitBy(a as any, hiddenField), omitBy(b as any, hiddenField)));
}

export function latest<T extends Cursor>(cs: T[]) {
  return cs.sort((a, b) => {
    return (b.modified?.valueOf() || 0) - (a.modified?.valueOf() || 0);
  });
}

export interface Icon extends Visibility {
  /**
   * Label to show in info row.
   * Will also use as default thumbnail if order is not negative.
   */
  label?: string;
  /**
   * Emoji to use as default thumbnail.
   */
  thumbnail?: string;
  /**
   * If set, makes this icon conditional on a tag.
   */
  tag?: string;
  /**
   * If set, makes this icon conditional on a plugin response from any user.
   */
  anyResponse?: `plugin/${string}` | `+plugin/${string}` | `_plugin/${string}`;
  /**
   * If set, makes this icon conditional on no plugin response from any user.
   */
  noResponse?: `plugin/${string}` | `+plugin/${string}` | `_plugin/${string}`;
  /**
   * If set, makes this icon conditional on the current user's plugin response.
   */
  response?: `plugin/user/${string}` | `+plugin/user/${string}` | `_plugin/user/${string}`;
  /**
   * If set, makes this icon conditional on a ref scheme.
   */
  scheme?: `${string}:`;
}

export interface FilterConfig {
  /**
   * Filter based on a tag query.
   * If set, no other filter types must be set.
   */
  query?: string;
  /**
   * Filter based on URL scheme.
   * If set, no other filter types must be set.
   */
  scheme?: string;
  /**
   * Filter based on sources to a Ref.
   * If set, no other filter types must be set.
   */
  sources?: string;
  /**
   * Filter based on responses to a Ref.
   * If set, no other filter types must be set.
   */
  responses?: string;
  /**
   * Filter based on plugin responses in metadata.
   * If set, query and scheme must not be set.
   */
  response?: `plugin/${string}` | `+plugin/${string}` | `_plugin/${string}` | `!plugin/${string}` | `!+plugin/${string}` | `!_plugin/${string}`;
  /**
   * Filter based on user plugin responses in metadata.
   * If set, query and scheme must not be set.
   */
  user?: `plugin/user/${string}` | `+plugin/user/${string}` | `_plugin/user/${string}` | `!plugin/user/${string}` | `!+plugin/user/${string}` | `!_plugin/user/${string}`;
  label?: string;
  title?: string;
  group?: string;
}

export interface EditorButton {
  /**
   * Query required to show this button (default to the parent tag).
   */
  query?: string;
  /**
   * Label for editor button.
   */
  label?: string;
  /**
   * Optional tooltip.
   */
  title?: string;
  /**
   * Label for editor button when toggled.
   */
  labelOn?: string;
  /**
   * Label for editor button when un-toggled.
   */
  labelOff?: string;
  /**
   * Tag to toggle on/off.
   */
  toggle?: string;
  /**
   * Show toggle as ribbon.
   */
  ribbon?: boolean;
  /**
   * Save toggle choice as default.
   */
  remember?: boolean;
  /**
   * Event to emit when clicked.
   */
  event?: string;
  /**
   * Event to listen for to stop showing loading indicator.
   * If set, button will show loading indicator after click until this event fires.
   */
  eventDone?: string;
  /**
   * Only show button if URL is of scheme.
   */
  scheme?: `${string}:`;
  /**
   * Show button on all Refs, not just refs with this tag.
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

  //cache
  _parent?: Config;
  _on?: boolean;
}

export type Action = (TagAction | ResponseAction | EmitAction | EventAction) & {
  /**
   * Display confirm message.
   */
  confirm?: string;
};

export interface TagAction extends Visibility {
  /**
   * Add a tag directly to the Ref.
   */
  tag: string;
  /**
   * Handlebars template label to show when this action has been applied.
   */
  labelOn?: string;
  /**
   * Handlebars template label to show when this action has not been applied.
   */
  labelOff?: string;
}

export interface ResponseAction extends Visibility {
  /**
   * Add a tag response to the Ref.
   */
  response: `plugin/user/${string}` | `+plugin/user/${string}` | `_plugin/user/${string}` | `!plugin/user/${string}` | `!+plugin/user/${string}` | `!_plugin/user/${string}`;
  /**
   * Clear other tag responses when adding tag response.
   */
  clear?: (`plugin/user/${string}` | `+plugin/user/${string}` | `_plugin/user/${string}`)[];
  /**
   * Handlebars template label to show when this action has been applied.
   * The response plugin must have metadata generation turned on.
   */
  labelOn?: string;
  /**
   * Handlebars template label to show when this action has not been applied.
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
   * If set, makes this icon conditional on a ref scheme.
   */
  scheme?: `${string}:`;
  /**
   * Handlebars template label.
   */
  label?: string;
}

export interface EmitAction extends Visibility {
  /**
   * Emit the templated json models.
   */
  emit: string;
  /**
   * Handlebars template label.
   */
  label?: string;
}

export function active(ref: Ref, o: TagAction | ResponseAction | EventAction | Icon) {
  if (('tag' in o) && !hasTag(o.tag, ref)) return false;
  if (('response' in o) && !hasResponse(o.response, ref)) return false;
  if (('anyResponse' in o) && !hasAnyResponse(o.anyResponse, ref)) return false;
  if (('noResponse' in o) && hasAnyResponse(o.noResponse, ref)) return false;
  return true;
}

// https://github.com/handlebars-lang/handlebars.js/issues/1593
// @ts-ignore
window.global = {};
window.Handlebars = Handlebars as any;

Handlebars.registerHelper('prefix', (p: string, r: string) => prefix(p, r));
Handlebars.registerHelper('uuid', () => uuid());
Handlebars.registerHelper('d3', () => d3);
Handlebars.registerHelper('defer', (el: Element, fn: () => {}) => {
  // @ts-ignore
  if (el.defered) {
    fn();
  } else {
    // @ts-ignore
    el.deferred = true;
    defer(fn);
  }
});
Handlebars.registerHelper('fromNow', (value: string) => DateTime.fromISO(value).toRelative());
Handlebars.registerHelper('formatInterval', (value: string) => Duration.fromISO(value).toHuman());
Handlebars.registerHelper('duration', (ref: Ref, tag: string, indexOrOptions: any) => {
  const index = typeof indexOrOptions === 'number' ? indexOrOptions : -1;
  const p = tag + '/';
  const t = ref?.tags?.find(t => t.startsWith(p));
  if (!t) return undefined;
  const result = t.substring(p.length);
  const value = index === -1 ? result : result.split('/')[index];
  const d = Duration.fromISO(value.toUpperCase());
  return d.isValid ? d : undefined;
});
Handlebars.registerHelper('human', (value: any) => {
  if (!value) return '';
  if (Duration.isDuration(value)) return value.toHuman();
  if (DateTime.isDateTime(value)) return value.toRelative() ?? '';
  if (typeof value === 'string') {
    const d = Duration.fromISO(value.toUpperCase());
    if (d.isValid) return d.toHuman();
    const dt = DateTime.fromISO(value);
    if (dt.isValid) return dt.toRelative() ?? '';
  }
  return String(value);
});
Handlebars.registerHelper('plugins', (ref: Ref, plugin: string) => ref.metadata?.plugins?.[plugin]);
Handlebars.registerHelper('response', (ref: Ref, value: string) => ref.metadata?.userUrls?.includes(value));
Handlebars.registerHelper('includes', (array: string[], value: string) => array?.includes(value));
Handlebars.registerHelper('interestingTags', (tags: string[]) => interestingTags(tags));
Handlebars.registerHelper('hasTag', (tag: string | undefined, ref: Ref | string[] | undefined) => hasTag(tag, ref));
Handlebars.registerHelper('tail', (text: string) => text.split('\n').pop()!.trim());
Handlebars.registerHelper('eq', (v1, v2) => v1 === v2);
Handlebars.registerHelper('ne', (v1, v2) => v1 !== v2);
Handlebars.registerHelper('lt', (v1, v2) => v1 < v2);
Handlebars.registerHelper('gt', (v1, v2) => v1 > v2);
Handlebars.registerHelper('lte', (v1, v2) => v1 <= v2);
Handlebars.registerHelper('gte', (v1, v2) => v1 >= v2);
Handlebars.registerHelper('and', function() {
  return Array.prototype.slice.call(arguments, 0, arguments.length - 1).every(Boolean);
});
Handlebars.registerHelper('or', function() {
  return Array.prototype.slice.call(arguments, 0, arguments.length - 1).some(Boolean);
});

export function hydrate(config: any, field: string, model: any): string {
  if (!config[field]) return '';
  config._cache ||= {};
  config._cache[field] ||= Handlebars.compile(config[field]);
  return config._cache[field](model);
}

export function emitModels(action: EmitAction, ref?: Ref, user?: string) {
  const hydrated = hydrate(action, 'emit', {
    action: toJS(action),
    ref: toJS(ref),
    user: user,
  });
  return filterModels(JSON.parse(hydrated));
}

export function clear<T extends Config>(c: T) {
  c = omitBy(c, i => !i) as any;
  c.config = omitBy(c.config, i => !i);
  delete c.config!.generated;
  delete c.config!.mod;
  delete c.config!._parent;
  delete c.defaults;
  delete c.type;
  delete c.origin;
  delete c.modified;
  delete c.modifiedString;
  delete c._cache;
  return c;
}

export type TagQueryArgs = {
  query?: string,
  nesting?: number,
  level?: number,
  deleted?: boolean,
  search?: string,
  modifiedBefore?: string,
  modifiedAfter?: string,
};

export type TagPageArgs = TagQueryArgs & {
  page?: number,
  size?: number,
  sort?: TagSort[],
};

export type TagSort = '' |
  'modified' | 'modified,ASC' | 'modified,DESC' |
  'tag' | 'tag,ASC' | 'tag,DESC' |
  'tag:len' | 'tag:len,ASC' | 'tag:len,DESC' |
  'name' | 'name,ASC' | 'name,DESC' |
  'origin' | 'origin,ASC' | 'origin,DESC' |
  'origin:len' | 'origin:len,ASC' | 'origin:len,DESC' |
  `config->${string}` | `config->${string},ASC` | `config->${string},DESC`;

export type ConfigSort = TagSort |
  `defaults->${string}` | `defaults->${string},ASC` | `defaults->${string},DESC` |
  `schema->${string}` | `schema->${string},ASC` | `schema->${string},DESC`;
