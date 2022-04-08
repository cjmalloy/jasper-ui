import * as _ from 'lodash';
import { Ref } from '../model/ref';

export const TAG_REGEX = /^_?[a-z]+(\/[a-z]+)*$/;
export const USER_REGEX = /^_?user\/[a-z]+(\/[a-z]+)*$/;
export const PLUGIN_REGEX = /^_?plugin\/[a-z]+(\/[a-z]+)*$/;
export const ORIGIN_NOT_BLANK_REGEX = /^@[a-z]+(\.[a-z]+)*$/;
export const ORIGIN_REGEX = /^(@[a-z]+(\.[a-z]+)*)?$/;
export const QUALIFIED_TAG_REGEX = /^(_?[a-z]+(\/[a-z]+)*|(_?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))$/;
export const SELECTOR_REGEX = /^!?(_?[a-z]+(\/[a-z]+)*|(_?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))$/;
export const QUERY_REGEX = /^!?(_?[a-z]+(\/[a-z]+)*|(_?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*))([ +|:&]!?(_?[a-z]+(\/[a-z]+)*|(_?[a-z]+(\/[a-z]+)*)?(@[a-z]+(\.[a-z])*|@\*)))*$/;

export function authors(ref: Ref) {
  return _.filter(ref.tags, t => t.startsWith('user/') || t.startsWith('_user/'))
  .map(t => t + ref.origin);
}

export function primaryAuthor(ref: Ref) {
  return _.find(ref.tags, t => t.startsWith('user/') || t.startsWith('_user/')) + ref.origin!;
}

export function webLink(ref: Ref) {
  const url = new URL(ref.url);
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export function refUrlSummary(ref: Ref) {
  const url = new URL(ref.url);
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return url.host;
  }
  return url.protocol.substring(0, url.protocol.length - 1);
}

export function interestingTags(tags?: string[]): string[] {
  return _.filter(tags, interestingTag);
}

export function interestingTag(tag: string) {
  if (tag === 'public') return false;
  if (tag === 'locked') return false;
  if (tag === 'internal') return false;
  if (tag.startsWith('plugin/')) return false;
  if (tag.startsWith('_plugin/')) return false;
  if (tag.startsWith('user/')) return false;
  if (tag.startsWith('_user/')) return false;
  return true;
}
