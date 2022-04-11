import * as _ from 'lodash';
import { Ref } from '../model/ref';

export const URI_REGEX = /^([^:/?#]+):(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
export const TAG_REGEX = /^[_+]?[a-z]+(\/[a-z]+)*$/;
export const TAG_REGEX_STRING = '^[_+]?[a-z]+(\/[a-z]+)*$';
export const USER_REGEX = /^[_+]user\/[a-z]+(\/[a-z]+)*$/;
export const PLUGIN_REGEX = /^[_+]?plugin\/[a-z]+(\/[a-z]+)*$/;
export const ORIGIN_NOT_BLANK_REGEX = /^@[a-z]+(\.[a-z]+)*$/;
export const ORIGIN_REGEX = /^(@[a-z]+(\.[a-z]+)*)?$/;
export const QUALIFIED_TAG_REGEX = /^([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))$/;
export const SELECTOR_REGEX = /^!?([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))$/;
export const QUERY_REGEX = /^(!?([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))|\(!?([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))([ |]!?([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*)))*\))([ |:&](!?([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))|\(!?([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))([ |]!?([_+]?[a-z]+(\/[a-z]+)*|([_+]?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*)))*\)))*$/;

export function isTemplate(tag: string, template?: string) {
  return tag.startsWith(template + '/') ||
    tag.startsWith('_' + template + '/') ||
    tag.startsWith('+' + template + '/');
}

export function templates(tags?: string[], template?: string) {
  return _.filter(tags, t => isTemplate(t, template));
}

export function hasTemplate(tags: string[], template: string) {
  return templates(tags, template).length > 0;
}

export function authors(ref: Ref) {
  return templates(ref.tags || [], 'user').map(t => t + ref.origin);
}

export function webLink(ref: Ref) {
  try {
    const url = new URL(ref.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

export function urlSummary(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.host;
    }
    return parsed.protocol.substring(0, parsed.protocol.length - 1);
  } catch (e) {}
  if (url.startsWith('lnbc')) return 'lnbc';
  return 'unknown';
}

export function interestingTags(tags?: string[]): string[] {
  return _.filter(tags, interestingTag);
}

export function interestingTag(tag: string) {
  if (tag === 'public') return false;
  if (tag === 'locked') return false;
  if (tag === 'internal') return false;
  if (tag === '_moderated') return false;
  if (tag.startsWith('plugin/')) return false;
  if (tag.startsWith('_plugin/')) return false;
  if (tag.startsWith('+plugin/')) return false;
  if (tag.startsWith('user/')) return false;
  if (tag.startsWith('_user/')) return false;
  if (tag.startsWith('+user/')) return false;
  return true;
}

export function isTextPost(ref: Ref) {
  return ref.url.startsWith('comment:') && (!ref.tags || !ref.tags?.includes('internal'));
}
