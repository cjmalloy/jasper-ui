import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const filePlugin: Plugin = {
  tag: 'plugin/file',
  name: $localize`💾️️ File`,
  config: {
    type: 'plugin',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`💾️️`, order: 1 }],
    filters: [
      { query: 'plugin/file', label: $localize`💾️️ file`, group: $localize`Plugins 🧰️` },
    ],
  },
};
