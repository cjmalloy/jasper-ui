import * as _ from 'lodash-es';
import { Ref } from '../model/ref';
import { config } from '../service/config.service';
import { hasPrefix, hasTag } from './tag';

export const URI_REGEX = /^([^:/?#]+):(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/;
export const TAG_REGEX = /^[_+]?[a-z0-9]+([./][a-z0-9]+)*$/;
export const TAGS_REGEX = /^([_+]?[a-z0-9]+([./][a-z0-9]+)*\s*)*$/;
export const USER_REGEX = /^[_+]user\/[a-z0-9]+([./][a-z0-9]+)*$/;
export const QUALIFIED_USER_REGEX = /^[_+]user\/[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const PLUGIN_REGEX = /^[_+]?plugin\/[a-z0-9]+([./][a-z0-9]+)*$/;
export const ORIGIN_NOT_BLANK_REGEX = /^@[a-z0-9]+(\.[a-z0-9]+)*$/;
export const ORIGIN_REGEX = /^(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const ORIGIN_WILDCARD_REGEX = /^(@[a-z0-9]+(\.[a-z0-9]+)*|@\*)?$/;
export const QUALIFIED_TAG_REGEX = /^[_+]?[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const SELECTOR_REGEX = /^!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9]+)*|@\*))$/;
export const QUERY_REGEX = /^(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9]+)*|@\*))|\(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*))([ |]!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*)))*\))([ |:&](!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*))|\(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*))([ |]!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*)))*\)))*$/;

export function templates(tags?: string[], template?: string) {
  return _.filter(tags, t => hasPrefix(t, template));
}

export function authors(ref: Ref) {
  return templates(ref.tags || [], 'user').map(t => t + (ref.origin || ''));
}

export function clickableLink(ref: Ref) {
  try {
    const url = new URL(ref.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
  } catch (e) { }
  for (const v of config().blockedSchemes) {
    if (ref.url.startsWith(v)) return false;
  }
  return true;
}

export function urlSummary(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.host;
    }
    return parsed.protocol.substring(0, parsed.protocol.length - 1);
  } catch (e) {}
  if (url.startsWith('lnbc')) return 'lightning';
  if (url.startsWith('bc1')) return 'bitcoin';
  if (url.startsWith('0x')) return 'ethereum';
  return 'unknown';
}

export function interestingTags(tags?: string[]): string[] {
  return _.filter(_.filter(tags, interestingTag), value => !prefixTag(value, tags!));
}

export function prefixTag(tag: string, tags: string[]) {
  if (tag.startsWith('_') || tag.startsWith('+')) return false;
  for (const t of tags) {
    if (t === tag) continue;
    if (t.startsWith(tag + '/')) return true;
  }
  return false;
}

export function interestingTag(tag: string) {
  if (tag === 'public') return false;
  if (tag === 'locked') return false;
  if (tag === 'internal') return false;
  if (tag === '_moderated') return false;
  if (hasPrefix(tag, 'plugin')) return false;
  if (hasPrefix(tag, 'user')) return false;
  if (tag === '+user') return false;
  if (tag === '_user') return false;
  return true;
}

export function formatAuthor(tag: string) {
  return tag
    .replace('+user@', '@')
    .replace('+', '')
    .replace('user/', '');
}

export function isTextPost(ref: Ref) {
  return ref.url.startsWith('comment:') && !hasTag('internal', ref);
}

export function wikiTitleFormat(title?: string) {
  if (!title) return undefined;
  return wikiUriFormat(title)
    .substring('wiki:'.length)
    .replace(/_/g, ' ');
}

export function wikiUriFormat(uri: string) {
  uri = uri.trim();
  if (uri.startsWith('wiki:')) {
    uri = uri.substring('wiki:'.length);
  }
  return 'wiki:' + (uri.substring(0, 1).toUpperCase() + uri.substring(1).toLowerCase())
    .replace(/\s+/g, '_')
    .replace(/\W+/g, '');
}
