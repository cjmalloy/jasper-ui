import * as _ from 'lodash';
import { getInbox } from '../plugin/inbox';
import { getRefUrl } from '../service/embed.service';
import { TAG_REGEX, URI_REGEX, USER_REGEX } from './format';

export function getSources(markdown: string) {
  return [
    ...extractPattern(markdown, /\[\[?\d+]?]:.*/g, /\[\[?\d+]?]:\s*(.*)/, URI_REGEX),
    ...extractPattern(markdown, /\[\[?\d+]?]:\s*\/ref\/.*/g, /\[\[?\d+]?]:\s*(\/ref\/.*)/).map(getRefUrl),
    ...extractPattern(markdown, /\[\[?\d+]?]\(.*\)/g, /\[\[?\d+]?]\((.*)\)/, URI_REGEX),
    ...extractPattern(markdown, /\[\[?\d+]?]\(\/ref\/.*\)/g, /\[\[?\d+]?]\((\/ref\/.*)\)/).map(getRefUrl),
  ];
}

export function getAlts(markdown: string) {
  return [
    ...extractPattern(markdown, /\[\[?alt\d*]?]:.*/g, /\[\[?alt\d*]?]:\s*(.*)/, URI_REGEX),
    ...extractPattern(markdown, /\[\[?alt\d+]?]:\s*\/ref\/.*/g, /\[\[?alt\d+]?]:\s*(\/ref\/.*)/).map(getRefUrl),
    ...extractPattern(markdown, /\[\[?alt\d*]?]\(.*\)/g, /\[\[?alt\d*]?]\((.*)\)/, URI_REGEX),
    ...extractPattern(markdown, /\[\[?alt\d+]?]\(\/ref\/.*\)/g, /\[\[?alt\d+]?]\((\/ref\/.*)\)/).map(getRefUrl),
  ];
}

export function getNotifications(markdown: string) {
  return extractPattern(markdown, /[_+]user\/[a-z]+(\/[a-z]+)*/g, /([_+]user\/[a-z]+(\/[a-z]+)*)/, USER_REGEX)
    .map(u => getInbox(u));
}

export function getTags(markdown: string) {
  return extractPattern(markdown, /#[a-z]+(\/[a-z]+)*/g, /#([a-z]+(\/[a-z]+)*)/, TAG_REGEX);
}

function extractPattern(markdown: string, pattern: RegExp, extractor: RegExp, validator?: RegExp) {
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
