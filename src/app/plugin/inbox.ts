import * as _ from 'lodash';
import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { authors } from '../util/format';

export const inboxPlugin: Plugin = {
  tag: 'plugin/inbox',
  name: 'Notifications Plugin',
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  },
};

export function inboxes(ref: Ref, myUserTag: string): string[] {
  return _.filter(authors(ref), tag => tag !== myUserTag).map(getInbox);
}

export function getInbox(userTag: string): string {
  if (userTag.startsWith('_')) {
    return '_plugin/inbox/' + userTag.substring(1);
  } else if (userTag.startsWith('+')) {
    return 'plugin/inbox/' + userTag.substring(1);
  } else {
    return 'plugin/inbox/' + userTag;
  }
}
