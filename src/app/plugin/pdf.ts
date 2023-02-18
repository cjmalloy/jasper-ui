import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const pdfPlugin: Plugin = {
  tag: 'plugin/pdf',
  name: $localize`PDF`,
  config: {
    type: 'viewer',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`📄️`}],
    filters: [
      { query: 'plugin/pdf', label: $localize`📄️ pdf`, group: $localize`Plugins 🧰️` },
    ],
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
