import { FormlyFieldConfig } from '@ngx-formly/core';
import { Schema } from 'jtd';
import * as moment from 'moment';

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
     * Optional CSS to be added to <head> on load.
     */
    css?: string,
    /**
     * Optional formly config for editing a form defined by the schema.
     */
    form?: FormlyFieldConfig[],
    /**
     * Add query or response filters to the filter dropdown.
     */
    filters?: FilterConfig[],
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
