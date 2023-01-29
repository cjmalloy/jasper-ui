import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const pdfPlugin: Plugin = {
  tag: 'plugin/pdf',
  name: $localize`PDF`,
  config: {
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    form: [{
      key: 'url',
      type: 'url',
      props: {
        label: $localize`URL:`,
      },
    }],
  },
  defaults: {},
  schema: {
    optionalProperties: {
      url: { type: 'string' },
    },
  },
};
