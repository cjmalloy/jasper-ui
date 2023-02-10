import * as moment from 'moment';
import { Template } from '../model/template';

export const rootTemplate: Template = {
  tag: '',
  name: $localize`/`,
  config: {
    default: true,
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    description: $localize`Root template to apply to all exts, adding pinned
    Refs, sidebar markdown, and custom themes.`
  },
  schema: {
    optionalProperties: {
      pinned: { elements: { type: 'string' } },
      sidebar: { type: 'string' },
      modmail: { type: 'boolean' },
      themes: { values: { type: 'string' } },
      theme: { type: 'string' },
    },
  },
};
