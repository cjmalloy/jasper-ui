import { Schema } from 'jtd';
import { cloneDeep } from 'lodash-es';
import { DateTime } from 'luxon';
import { Ext } from './ext';
import { Page } from './page';
import { Ref, RefNode } from './ref';
import { Config, TagSort } from './tag';
import { Roles } from './user';

export interface Template extends Config {
  config?: Config['config'] & {
    /**
     * Do not render forms from inherited Templates. If unset forms
     * will stack from abstract to specific inheritance.
     */
    overrideForm?: boolean,
    /**
     * Show built-in custom view.
     */
    view?: string,
    /**
     * Optional handlebars template to render instead of the default
     * Ref list when this view is active. The scope contains `ext`,
     * `template`, `account`, `el`, the first `page` of results, the
     * `query` and its `params`, and a {@link LensUiApi} as `actions`.
     */
    ui?: string,
    /**
     * Do not render UIs from inherited Templates. If unset UIs
     * will stack from abstract to specific inheritance.
     */
    overrideUi?: boolean,
    /**
     * Optional handlebars template to render in the sidebar.
     */
    sidebarUi?: string,
    /**
     * Do not render sidebar UIs from inherited Templates. If unset
     * sidebar UIs will stack from abstract to specific inheritance.
     */
    overrideSidebarUi?: boolean,
    /**
     * Override the view text used in a tab.
     */
    tab?: string,
    /**
     * Always use fully qualified tag when creating web links.
     */
    local?: boolean,
    /**
     * This view is available by default, no tagging required.
     */
    global?: boolean;
    /**
     * Submit text instead of links by default.
     */
    submitText?: boolean,
    /**
     * Add to the sort dropdown.
     */
    sorts?: SortConfig[],
    /**
     * Show this tag as the recipient instead, for example when messages
     * to a protected tag are delivered to its public mailbox.
     */
    signature?: string,
  };
  // Client-only
  type?: 'template';
}

export interface SortConfig {
  sort: TagSort;
  label: string;
  title?: string;
}

export const templateSchema: Schema = {
  optionalProperties: {
    tag: { type: 'string' },
    name: { type: 'string' },
    config: {},
    defaults: {},
    schema: {},
  }
};

export function mapTemplate(obj: any): Template {
  obj.type = 'template';
  obj.tag ||= '';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = obj.modified && DateTime.fromISO(obj.modified);
  return obj;
}

export function maybeTemplate(obj: any): Template | undefined {
  if (!obj) return undefined;
  return mapTemplate(obj);
}

export function writeTemplate(template: Template): Template {
  const result = { ...template };
  if (result.modifiedString) result.modified = result.modifiedString as any;
  delete result.type;
  delete result.upload;
  delete result.exists;
  delete result.outdated;
  delete result.modifiedString;
  delete result.config?._cache;
  return result;
}

/**
 * Actions available to a Template {@link Template.config.ui}.
 * Functions that mount Angular components into an element return a function
 * to destroy them. Anything still mounted is destroyed when the view is.
 */
/**
 * Call to destroy a mounted component early. Otherwise it is destroyed with the view.
 */
export type LensUiMount = (() => void) & {
  /** Does the component have an unsaved draft. */
  hasChanges: () => boolean;
};

export interface LensUiApi {
  /** Fetch a page of the current query, with the same query, sort, filter and search as the view. */
  fetch: (page?: number, size?: number) => Promise<Page<Ref>>;
  /** Fetch graph nodes (Refs with sources and responses) by URL. Missing Refs are null. */
  graph: (urls: string[]) => Promise<(RefNode | null)[]>;
  /** Render a Ref's media and content with the built-in viewer. */
  embed: (el: Element, ref: Ref) => LensUiMount;
  /** Render a Ref row. */
  ref: (el: Element, ref: Ref) => LensUiMount;
  /** Render a list of Ref rows. Call update to change the Refs without losing drafts. */
  list: (el: Element, refs: Ref[], emptyMessage?: string) => LensUiMount & { update: (refs: Ref[]) => void };
  /** Label of the first active icon for a Ref. */
  icon: (ref: Ref) => string;
  /** Display title for a Ref. */
  title: (ref: Ref) => string;
  /** Does the Ref have a tag in the current query. */
  matches: (ref: Ref) => boolean;
  /** Run when the view is re-rendered or destroyed. */
  onDestroy: (fn: () => void) => void;
}

export interface TemplateScope {
  [record: string]: any,
  ext: Ext;
  template: Template;
}

export function getTemplateScope(account: Roles, template: Template, ext: Ext, el?: Element, actions?: any): TemplateScope {
  return {
    el,
    ...actions || {},
    account: cloneDeep(account),
    ext: cloneDeep(ext),
    template: cloneDeep(template),
    ...(ext.config || {}),
  };
}
