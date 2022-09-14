import * as _ from 'lodash-es';
import { Ref } from '../model/ref';
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

export function hasTag(tag?: string, ref?: Ref)  {
  if (!tag) return false;
  if (!ref?.tags) return false;
  return !!_.find(ref.tags, t => hasPrefix(t, tag));
}

export function isOwner(user: User, ref: Ref) {
  if (user.origin !== ref.origin) return false;
  return hasTag(user.tag, ref);
}

export function isOwnerTag(tag: string, ref: Ref) {
  if (ref.origin) return false;
  return hasTag(tag, ref);
}

/**
 * Return local tag if origin is a wildcard.
 */
export function removeWildcard(tag: string) {
  if (tag === '@*') return '';
  if (tag === '*') return '';
  if (tag.endsWith('@*')) {
    return tag.substring(0, tag.length - 2);
  }
  return tag;
}
export function localTag(tag: string) {
  if (!tag.includes('@')) return tag;
  return tag.substring(0, tag.indexOf('@'));
}

export function tagOrigin(tag: string) {
  if (!tag.includes('@')) return '';
  return tag.substring(tag.indexOf('@'));
}

export function prefix(prefix: string, tag: string) {
  if (tag.startsWith('_')) {
    return prefix + tag.substring(1);
  }
  return prefix + tag.replace('+', '');
}

export function hasPrefix(tag?: string, prefix?: string) {
  if (!tag || !prefix) return false;
  return tag.startsWith(prefix) ||
    tag.startsWith('_' + prefix) ||
    tag.startsWith('+' + prefix);
}

export type Crumb = {text: string, tag?: string};
export function breadcrumbs(tag: string) {
  if (!tag) return [];
  return tag.split(/([:|()])/g).flatMap(t => {
    if (/[:|()]/.test(t)) return [{ text: t }];
    const htags: Crumb[] = localTag(t).split(/(\/)/g).map(t => ({ text: t }));
    for (let i = 0; i < htags.length; i++) {
      const previous = i > 1 ? htags[i-2].tag + '/' : '';
      if (htags[i].text !== '/') {
        htags[i].tag = previous + htags[i].text;
      }
    }
    const origin = tagOrigin(t);
    if (origin) {
      for (const t of htags) {
        if (t.tag) t.tag += origin;
      }
      htags.push({text: origin, tag: origin });
    }
    return htags;
  });
}

export function isQuery(query?: string) {
  if (!query) return false;
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
