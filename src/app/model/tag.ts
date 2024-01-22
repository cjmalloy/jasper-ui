import { FormlyFieldConfig } from '@ngx-formly/core';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { Schema } from 'jtd';
import { toJS } from 'mobx';
import * as moment from 'moment';
import { v4 as uuid } from 'uuid';
import { hasTag, prefix } from '../util/tag';
import { filterModels } from '../util/zip';
import { Ref } from './ref';
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

  //cache
  _parent?: Config;
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
  /**
   * Label to show in info row. Will also use as default thumbnail.
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
   * If set, makes this icon conditional on a tag response.
   */
  response?: `plugin/${string}`;
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
  response?: `plugin/${string}` | `!plugin/${string}`;
  label?: string;
  group?: string;
}

export type Action = TagAction | ResponseAction | EmitAction | EventAction;

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
  response: `plugin/${string}`;
  /**
   * Clear other tag responses when adding tag response.
   */
  clear?: `plugin/${string}`[];
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
  if ('scheme' in o) return true;
  if (!('tag' in o || 'response' in o)) return true;
  if (('tag' in o) && hasTag(o.tag, ref)) return true;
  if (('response' in o) && o.response && ref.metadata?.userUrls?.includes(o.response)) return true;
  return false;
}

// https://github.com/handlebars-lang/handlebars.js/issues/1593
// @ts-ignore
window.global = {};
window.Handlebars = Handlebars as any;

Handlebars.registerHelper('prefix', (p: string, r: string) => {
  return prefix(p, r);
});

Handlebars.registerHelper('uuid', () => uuid());

Handlebars.registerHelper('fromNow', value => moment(value).fromNow());

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

export function emitModels(action: EmitAction, ref: Ref, user: string) {
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
