import * as moment from 'moment';
import { HasOrigin } from './tag';

export interface Ref extends HasOrigin {
  url: string;
  tags?: string[];
  title?: string;
  comment?: string;
  sources?: string[];
  alternateUrls?: string[];
  plugins?: Record<string, any>;
  metadata?: Metadata;
  published?: moment.Moment;
  created?: moment.Moment;
}

export interface RefNode extends Ref {
  responses?: string[]
}

export interface Metadata {
  modified?: string;
  responses?: number;
  internalResponses?: number;
  plugins?: Record<string, number>;
  userUrls?: string[];
}

export type Filter =
  'untagged' |
  'uncited' |
  'unsourced';

type FilterObj = {
  [name in Filter]?: boolean;
};

export type RefFilter = FilterObj & {
  scheme?: string;
  pluginResponse?: string[];
  noPluginResponse?: string[];
};

export type RefQueryArgs = RefFilter & {
  query?: string;
  url?: string;
  responses?: string;
  sources?: string;
  search?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  createdAfter?: string;
  createdBefore?: string;
  responseAfter?: string;
  responseBefore?: string;
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
  'metadataModified' | 'metadataModified,ASC' | 'metadataModified,DESC' |
  'url' | 'url,ASC' | 'url,DESC' |
  'scheme' | 'scheme,ASC' | 'scheme,DESC' |
  'title' | 'title,ASC' | 'title,DESC' |
  'origin' | 'origin,ASC' | 'origin,DESC' |
  'comment' | 'comment,ASC' | 'comment,DESC' |
  'tagCount' | 'tagCount,ASC' | 'tagCount,DESC' |
  'sourceCount' | 'sourceCount,ASC' | 'sourceCount,DESC' |
  'responseCount' | 'responseCount,ASC' | 'responseCount,DESC' |
  'commentCount' | 'commentCount,ASC' | 'commentCount,DESC' |
  'voteCount' | 'voteCount,ASC' | 'voteCount,DESC' |
  'voteScore' | 'voteScore,ASC' | 'voteScore,DESC' |
  'voteScoreDecay' | 'voteScoreDecay,ASC' | 'voteScoreDecay,DESC';

export function mapRef(obj: any): Ref {
  obj.origin ||= '';
  obj.published = obj.published && moment(obj.published);
  obj.created = obj.created && moment(obj.created);
  obj.modifiedString = obj.modified;
  obj.modified = obj.modified && moment(obj.modified);
  return obj;
}

export function mapRefOrNull(obj: any): Ref | null {
  if (!obj) return null;
  return mapRef(obj);
}

export function writeRef(ref: Ref): Ref {
  const result = { ...ref } as any;
  result.published &&= moment(result.published);
  result.modified = result.modifiedString as any;
  delete result.upload;
  delete result.exists;
  delete result.metadata;
  delete result.modifiedString;
  delete result.created;
  // Added by graphing
  delete result.unloaded;
  delete result.notFound;
  delete result.index;
  delete result.x;
  delete result.y;
  delete result.vx;
  delete result.vy;
  delete result.fx;
  delete result.fy;
  return result;
}
