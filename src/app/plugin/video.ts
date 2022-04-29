import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const videoPlugin: Plugin = {
  tag: 'plugin/video',
  name: 'Video Plugin',
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  },
};
