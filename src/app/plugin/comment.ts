import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const commentPlugin: Plugin = {
  tag: 'plugin/comment',
  name: $localize`Comment`,
  config: {
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  defaults: {},
  schema: {
    optionalProperties: {
      deleted: { type: 'boolean' },
    },
  },
  generateMetadata: true,
};
