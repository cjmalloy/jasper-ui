import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const commentPlugin: Plugin = {
  tag: 'plugin/comment',
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  },
  defaults: {},
  schema: {
    optionalProperties: {
      deleted: { type: 'boolean' },
    },
  },
  generateMetadata: true,
};
