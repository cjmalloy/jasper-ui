import { Ref } from "../model/ref";
import * as _ from "lodash";

export function authors(ref: Ref) {
  return _.filter(ref.tags, t => t.startsWith('user/'));
}

export function primaryAuthor(ref: Ref) {
  return _.find(ref.tags, t => t.startsWith('user/'));
}

export function interestingTags(tags?: string[]): string[] {
  return _.filter(tags, interestingTag);
}
export function interestingTag(tag: string) {
  if (tag === 'public') return false;
  if (tag === 'locked') return false;
  if (tag.startsWith('plugin/')) return false;
  if (tag.startsWith('user/')) return false;
  return true;
}
