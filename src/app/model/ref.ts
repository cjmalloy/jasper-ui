import { isEqual } from 'lodash-es';
import { DateTime } from 'luxon';
import { hasPrefix, publicTag } from '../util/tag';
import { Cursor } from './tag';

export interface Ref extends Cursor {
  url: string;
  tags?: string[];
  title?: string;
  comment?: string;
  sources?: string[];
  alternateUrls?: string[];
  plugins?: Record<string, any>;
  metadata?: Metadata;
  published?: DateTime;
  created?: DateTime;
}

/**
 * Sent in response to websocket subscription.
 *
 * Only includes non-private tags, metadata, and plugins.
 */
export interface RefUpdates extends Cursor {
  url: string;
  tags?: string[];
  title?: string;
  comment?: string;
  sources?: string[];
  alternateUrls?: string[];
  plugins?: Record<string, any>;
  metadata?: MetadataUpdates;
  published?: DateTime;
  created?: DateTime;
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
  obsolete?: boolean;
}

/**
 * Sent in response to websocket subscription.
 *
 * Only includes non-private tags, metadata, and plugins.
 */
export interface MetadataUpdates {
  modified?: string;
  responses?: number;
  internalResponses?: number;
  plugins?: Record<string, number>;
  obsolete?: boolean;
}

export type Filter =
  'untagged' |
  'uncited' |
  'unsourced' |
  'obsolete';

type FilterObj = {
  [name in Filter]?: boolean;
};

export type RefFilter = FilterObj & {
  query?: string;
  scheme?: string;
  pluginResponse?: string[];
  noPluginResponse?: string[];
  url?: string;
  obsolete?: boolean;
  responses?: string;
  sources?: string;
  search?: string;
  modifiedAfter?: string | DateTime;
  modifiedBefore?: string | DateTime;
  publishedAfter?: string | DateTime;
  publishedBefore?: string | DateTime;
  createdAfter?: string | DateTime;
  createdBefore?: string | DateTime;
  responseAfter?: string | DateTime;
  responseBefore?: string | DateTime;
};

export type RefPageArgs = RefFilter & {
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
  'obsolete' | 'obsolete,ASC' | 'obsolete,DESC' |
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
  obj.published &&= DateTime.fromISO(obj.published);
  obj.created &&= DateTime.fromISO(obj.created);
  obj.modifiedString = obj.modified;
  obj.modified &&= DateTime.fromISO(obj.modified);
  return obj;
}

export function mapRefOrNull(obj: any): Ref | null {
  if (!obj) return null;
  return mapRef(obj);
}

export function writeRef(ref: Ref): Ref {
  const result = { ...ref } as any;
  if (DateTime.isDateTime(ref.created)) result.created = ref.created.toUTC().toISO();
  if (DateTime.isDateTime(ref.published)) result.published = ref.published.toUTC().toISO();
  result.modified = result.modifiedString as any;
  delete result.upload;
  delete result.exists;
  delete result.metadata;
  delete result.modifiedString;
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

/**
 * Find URL in alts with file extension.
 */
export function findExtension(ending: string, ref?: Ref, repost?: Ref) {
  if (!ref) return undefined;
  ending = ending.toLowerCase();
  if (ref.url.toLowerCase().endsWith(ending)) return ref.url;
  const urls = [
    ...(ref.alternateUrls || []),
    ...(repost?.alternateUrls || [])];
  for (const s of urls) {
    if (new URL(s).pathname.toLowerCase().endsWith(ending)) {
      return s;
    }
  }
  return undefined;
}

export function isRef(a?: Ref, b?: Ref) {
  if (!a || !b) return false;
  return (a.origin === b.origin || !a.origin && !b.origin) &&
    a.url === b.url;
}

export function equalsRef(a?: Ref, b?: Ref) {
  if (!a || !b) return false;
  const compareTag = (t: string) => publicTag(t) && !hasPrefix(t, 'plugin/inbox') && !hasPrefix(t, 'plugin/outbox');
  return a.url === b.url &&
    a.title === b.title &&
    a.comment === b.comment &&
    !!a.published === !!b.published &&
    b.published && a.published?.hasSame(b.published, 'millisecond') &&
    isEqual(a.alternateUrls, b.alternateUrls) &&
    isEqual(a.sources, b.sources) &&
    isEqual(a.tags?.filter(compareTag), b.tags?.filter(compareTag)) &&
    isEqual(a.plugins, b.plugins);
}
