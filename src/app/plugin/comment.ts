import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const commentPlugin: Plugin = {
  tag: 'plugin/comment',
  name: 'Comment',
  config: {
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
  },
  defaults: {},
  schema: {
    optionalProperties: {
      deleted: { type: 'boolean' },
    },
  },
  generateMetadata: true,
};
