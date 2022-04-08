import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const emojiPlugin: Plugin  = {
  tag: 'plugin/emoji',
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  },
};
