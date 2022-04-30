import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const audioPlugin: Plugin = {
  tag: 'plugin/audio',
  name: 'Audio Plugin',
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
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
