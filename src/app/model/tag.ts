import { FormlyFieldConfig } from '@ngx-formly/core';
import * as d3 from 'd3';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { Schema } from 'jtd';
import { defer, isEqual, omitBy, uniqWith } from 'lodash-es';
import { toJS } from 'mobx';
import * as moment from 'moment';
import { MomentInput } from 'moment/moment';
import { v4 as uuid } from 'uuid';
import { hasAnyResponse, hasResponse, hasTag, prefix } from '../util/tag';
import { filterModels } from '../util/zip';
import { Plugin } from './plugin';
import { Ref } from './ref';
import { Template } from './template';
import { Role } from './user';

export interface HasOrigin {
  origin?: string;
}
export interface Cursor extends HasOrigin {
  upload?: boolean;
  exists?: boolean;
  modified?: moment.Moment;
  // Saved to pass modified check since moment looses precision
  modifiedString?: string;
}

export interface Tag extends Cursor {
  type?: 'ext' | 'user' | 'plugin' | 'template';
  tag: string;
  name?: string;
}

export interface Mod {
  plugins?: Record<string, Plugin>;
  templates?: Record<string, Template>;
}

export type ModType = 'config' | 'icon' | 'feature' | 'lens' | 'plugin' | 'editor' | 'semantic' | 'theme' | 'tool';

export interface Config extends Tag {
  type?: 'plugin' | 'template';
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
  /**
   * Cache for compiled templates.
   */
  _cache?: any;
}

export interface Visibility {
  /**
   * Optional handlebars template tooltip.
   */
  title?: string;
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

export function visible(v: Visibility, isAuthor: boolean, isRecipient: boolean) {
  if (!v.visible) return true;
  if (isAuthor) return v.visible === 'author' || v.visible === 'participant';
  if (isRecipient) return v.visible === 'recipient' || v.visible === 'participant';
  return false;
}

export function sortOrder<T extends { order?: number }>(vs: T[]) {
  return vs.sort((a, b) => {
    if (!a.order || !b.order) return (b.order || 0) - (a.order || 0);
    if (Math.sign(a.order) !== Math.sign(b.order)) return b.order - a.order;
    return a.order - b.order;
  });
}

export function uniqueConfigs<T extends Visibility>(vs: T[]) {
  const hiddenField = (v: string, k: string) => k.startsWith('_')
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
  response?: `plugin/${string}` | `+plugin/${string}` | `_plugin/${string}`;
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
   * Filter based on plugin responses in metadata. Plugins must have be
   * generating metadata to work.
   * If set, query  and scheme must not be set.
   */
  response?: `plugin/${string}` | `+plugin/${string}` | `_plugin/${string}` | `!plugin/${string}` | `!+plugin/${string}` | `!_plugin/${string}`;
  label?: string;
  group?: string;
}

export interface EditorButton {
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
  response: `plugin/${string}` | `+plugin/${string}` | `_plugin/${string}` | `!plugin/${string}` | `!+plugin/${string}` | `!_plugin/${string}`;
  /**
   * Clear other tag responses when adding tag response.
   */
  clear?: (`plugin/${string}` | `+plugin/${string}` | `_plugin/${string}`)[];
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

Handlebars.registerHelper('fromNow', (value: MomentInput) => moment(value).fromNow());

Handlebars.registerHelper('formatInterval', (value: string) => moment.duration(value).humanize());

Handlebars.registerHelper('response', (ref: Ref, value: string) => {
  return ref.metadata?.userUrls?.includes(value);
});

Handlebars.registerHelper('includes', (array: string[], value: string) => {
  return array?.includes(value);
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

export type TagQueryArgs = {
  query?: string,
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
  'levels' | 'levels,ASC' | 'levels,DESC' |
  'name' | 'name,ASC' | 'name,DESC' |
  'origin' | 'origin,ASC' | 'origin,DESC';
