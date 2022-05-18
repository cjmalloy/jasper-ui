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
export function localTag(tag: string) {
  if (tag.startsWith('@')) return '';
  if (tag.endsWith('@*')) {
    return tag.substring(0, tag.length - 2);
  }
  return tag;
}

export function prefix(prefix: string, tag: string) {
  if (tag.startsWith('_')) {
    return prefix + tag.substring(1);
  }
  return prefix + tag.replace('+', '');
}

export function publicTag(tag: string) {
  return !tag.startsWith("_") && !tag.startsWith("+");
}
