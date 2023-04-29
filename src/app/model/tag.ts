import { FormlyFieldConfig } from '@ngx-formly/core';
import * as Handlebars from 'handlebars';
import { Schema } from 'jtd';
import { toJS } from 'mobx';
import * as moment from 'moment';
import { hasTag } from '../util/tag';
import { filterModels } from '../util/zip';
import { Ref } from './ref';
import { Role } from './user';

export interface HasModified {
  upload?: boolean;
  exists?: boolean;
  modified?: moment.Moment;
  modifiedString?: string;
}

export interface HasOrigin extends HasModified {
  origin?: string;
}

export interface Tag extends HasOrigin {
  type?: 'ext' | 'user' | 'plugin' | 'template';
  tag: string;
  name?: string;
}

export interface Config extends Tag {
  type?: 'plugin' | 'template';
  config?: {
    /**
     * Configs may only be created and edited by admin, so we allow anything.
     * Schemas are only used on non-admin config.
     */
    [record: string]: any,
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
     * Plugin dependencies.
     */
    requiredPlugins?: string[],
    /**
     * Template dependencies.
     */
    requiredTemplates?: string[],
    /**
     * Optional CSS to be added to <head> on load.
     */
    css?: string,
    /**
     * Optional formly config for editing a form defined by the schema.
     */
    form?: FormlyFieldConfig[],
    /**
     * Optional formly config for editing the config.
     */
    configForm?: FormlyFieldConfig[],
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

export interface FilterConfig {
  /**
   * Filter based on a tag query.
   * If set, response and scheme must not be set.
   */
  query?: string;
  /**
   * Filter based on URL scheme.
   * If set, tag and response must not be set.
   */
  scheme?: string;
  /**
   * Filter based on plugin responses in metadata. Plugins must have be
   * generating metadata to work.
   * If set, query  and scheme must not be set.
   */
  response?: `plugin/${string}` | `-plugin/${string}`;
  label?: string;
  group?: string;
}

export type Action = TagAction | ResponseAction | ReplyAction | EmitAction | EventAction;

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

export interface ReplyAction extends Visibility {
    /**
     * Add a tag reply to the Ref.
     */
    reply: string;
    /**
     * Label to show when this ref does not have a tagged reply.
     * The response plugin must have metadata generation turned on.
     */
    label?: string;
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

export interface EmitAction extends Visibility {
    /**
     * Emit the templated json models.
     */
    emit: string;
    /**
     * Event label.
     */
    label?: string;

    // Cache
    _emit?: HandlebarsTemplateDelegate;
}

export function active(ref: Ref, o: TagAction | ResponseAction | Icon) {
    if ('scheme' in o) return true;
    if (!('tag' in o || 'response' in o)) return true;
    if (('tag' in o) && hasTag(o.tag, ref)) return true;
    if (('response' in o) && o.response && ref.metadata?.userUrls?.includes(o.response)) return true;
    return false;
}

export function emitModels(action: EmitAction, ref: Ref, user: string) {
    if (!action.emit) return {ref: [], ext: []};
    if (!action._emit) {
        action._emit = Handlebars.compile(action.emit);
    }
    const hydrated = action._emit!({
        action: toJS(action),
        ref: toJS(ref),
        user: user,
    });
    return filterModels(JSON.parse(hydrated));
}

export type TagQueryArgs = {
  query?: string,
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
  'name' | 'name,ASC' | 'name,DESC' |
  'origin' | 'origin,ASC' | 'origin,DESC';
