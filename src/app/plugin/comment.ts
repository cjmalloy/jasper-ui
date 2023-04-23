import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const commentPlugin: Plugin = {
  tag: 'plugin/comment',
  name: $localize`💬️ Comment`,
  config: {
    type: 'viewer',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    filters: [
      { query: 'plugin/comment', label: $localize`💬️ comments`, group: $localize`Plugins 🧰️` },
    ],
    reply: ['internal', 'plugin/comment'],
  },
  defaults: {},
  schema: {
    optionalProperties: {
      deleted: { type: 'boolean' },
    },
  },
  generateMetadata: true,
};
