import * as moment from 'moment';
import { HasTags } from './tag';

export interface Ref extends HasTags {
  title?: string;
  comment?: string;
  sources?: string[];
  alternateUrls?: string[];
  plugins?: Record<string, any>;
  metadata?: Metadata;
  published?: moment.Moment;
  created?: moment.Moment;
}

export interface Metadata {
  responses: string[];
  internalResponses: string[];
  plugins: Record<string, string[]>;
}

export type RefFilter = {
  responses?: string,
  sources?: string,
  uncited?: boolean,
  unsourced?: boolean,
  pluginResponse?: string;
  noPluginResponse?: string;
};

export type RefQueryArgs = RefFilter & {
  query?: string,
  url?: string,
  search?: string,
  modifiedAfter?: moment.Moment,
};

export type RefPageArgs = RefQueryArgs & {
  page?: number,
  size?: number,
  sort?: RefSort[],
};

export type RefSort = '' | 'rank' | 'rank,DESC' |
  'created' | 'created,ASC' | 'created,DESC' |
  'modified' | 'modified,ASC' | 'modified,DESC' |
  'published' | 'published,ASC' | 'published,DESC' |
  'url' | 'url,ASC' | 'url,DESC' |
  'title' | 'title,ASC' | 'title,DESC' |
  'origin' | 'origin,ASC' | 'origin,DESC' |
  'comment' | 'comment,ASC' | 'comment,DESC' |
  'sourceCount' | 'sourceCount,ASC' | 'sourceCount,DESC' |
  'responseCount' | 'responseCount,ASC' | 'responseCount,DESC' |
  'commentCount' | 'commentCount,ASC' | 'commentCount,DESC';

export function mapRef(obj: any): Ref {
  obj.published = moment(obj.published);
  obj.created = moment(obj.created);
  obj.modified = moment(obj.modified);
  return obj;
}

export function mapRefOrNull(obj: any): Ref | null {
  if (!obj) return null;
  return mapRef(obj);
}

export function writeRef(ref: Ref): Record<string, any> {
  const result = { ...ref };
  delete result.metadata;
  delete result.created;
  result.published = moment(result.published);
  result.published = moment(result.published);
  return result;
}
