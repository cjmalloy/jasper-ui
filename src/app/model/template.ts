import { Schema } from 'jtd';
import { DateTime } from 'luxon';
import { toJS } from 'mobx';
import { Ext } from './ext';
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

export interface TemplateScope {
  [record: string]: any,
  ext: Ext;
  template: Template;
}

export function getTemplateScope(account: Roles, template: Template, ext: Ext, el?: Element, actions?: any): TemplateScope {
  return {
    el,
    ...actions || {},
    account: toJS(account),
    ext: toJS(ext),
    template: toJS(template),
    ...(ext.config || {}),
  };
}
