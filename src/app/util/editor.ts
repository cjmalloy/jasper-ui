import * as _ from 'lodash-es';
import { getInbox } from '../plugin/inbox';
import { TAG_REGEX, USER_REGEX } from './format';

export function getNotifications(markdown: string) {
  return extractPattern(markdown, /[_+]user\/[a-z]+(\/[a-z]+)*/g, /([_+]user\/[a-z]+(\/[a-z]+)*)/, USER_REGEX)
    .map(u => getInbox(u));
}

export function getTags(markdown: string) {
  return extractPattern(markdown, /#[a-z]+(\/[a-z]+)*/g, /#([a-z]+(\/[a-z]+)*)/, TAG_REGEX);
}

export function extractPattern(markdown: string, pattern: RegExp, extractor: RegExp, validator?: RegExp) {
  const result: string[] = [];
  const matches = markdown.match(pattern);
  for (const s of matches || []) {
    const url = s.match(extractor)![1].trim();
    if (!validator || validator.test(url)) {
      result.push(url);
    }
  }
  return result;
}

export function getIfNew<T>(list: T[], old?: T[]): T[] | null {
  old ??= [];
  const diff = _.uniq(_.difference(list, old));
  if (!diff.length) return null;
  return [...old, ...diff];
}
