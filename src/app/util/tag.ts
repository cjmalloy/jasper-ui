import * as _ from 'lodash-es';
import { HasTags } from '../model/tag';
import { User } from '../model/user';

export function qualifyTags(tags?: string[], origin?: string): string[] | undefined {
  if (!tags) return undefined;
  if (!origin) return tags;
  return tags.map(t => t + origin);
}

export function decompose(tag: string): [string, string] {
  const index = tag.indexOf('@');
  if (index === -1) return [tag, ''];
  return [tag.substring(0, index), tag.substring(index)];
}

export function captures(selector: string, target: string): boolean {
  const [sTag, sOrigin] = decompose(selector);
  const [tTag, tOrigin] = decompose(target);
  if (sTag && sTag !== tTag) return false;
  return sOrigin === '@*' || sOrigin === tOrigin;
}

export function capturesAny(selectors?: string[], target?: string[]): boolean {
  if (!selectors || !target) return false;
  if (!selectors.length || !target.length) return false;
  for (const s of selectors) {
    for (const t of target) {
      if (captures(s, t)) return true;
    }
  }
  return false;
}

export function isOwner(user: User, ref: HasTags) {
  if (user.origin !== ref.origin) return false;
  return ref.tags?.includes(user.tag);
}

export function isOwnerTag(tag: string, ref: HasTags) {
  if (ref.origin) return false;
  return ref.tags?.includes(tag);
}

/**
 * Return local tag if origin is a wildcard.
 */
export function removeOriginWildcard(tag: string) {
  if (tag.startsWith('@')) return '';
  if (tag.endsWith('@*')) {
    return tag.substring(0, tag.length - 2);
  }
  return tag;
}
export function localTag(tag: string) {
  if (!tag.includes('@')) return tag;
  return tag.substring(0, tag.indexOf('@'));
}

export function prefix(prefix: string, tag: string) {
  if (tag.startsWith('_')) {
    return prefix + tag.substring(1);
  }
  return prefix + tag.replace('+', '');
}

export function hasPrefix(tag: string, prefix: string) {
  return tag.startsWith(prefix) ||
    tag.startsWith('_' + prefix) ||
    tag.startsWith('+' + prefix);
}

export function isQuery(query: string) {
  return /[:|!()]/g.test(query);
}

export function publicTag(tag: string) {
  return !tag.startsWith("_") && !tag.startsWith("+");
}

export function parentTag(tag: string): string | undefined {
  if (!tag.includes('/')) return undefined;
  return tag.substring(0, tag.lastIndexOf('/'));
}

export function removeTag(tag: string | undefined, tags: string[]): string[] {
  while (tag) {
    tags = _.without(tags, tag);
    tag = parentTag(tag);
  }
  return tags;
}
