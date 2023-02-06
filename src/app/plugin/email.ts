import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const emailPlugin: Plugin = {
  tag: 'plugin/email',
  name: $localize`Email`,
  config: {
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Attempt to merge similar Refs tagged plugin/email into threads.`,
    icons: [
      { label: $localize`📧️` },
    ],
  },
  generateMetadata: true,
};
