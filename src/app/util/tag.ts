import { User } from "../model/user";
import { Ref } from "../model/ref";

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

export function isOwner(user: User, ref: Ref) {
  if (user.origin !== ref.origin) return false;
  return ref.tags?.includes(user.tag);
}
