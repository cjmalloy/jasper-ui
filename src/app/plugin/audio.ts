import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const audioPlugin: Plugin = {
  tag: 'plugin/audio',
  name: 'Audio',
  config: {
    type: 'viewer',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`📻️`}],
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

export const audioExtensions = ['.mp3', '.aac', '.flac', '.m4a', '.ogg', '.wav'];

export function isAudio(url: string) {
  return audioExtensions.includes(url.slice(url.lastIndexOf('.')).toLowerCase());
}
