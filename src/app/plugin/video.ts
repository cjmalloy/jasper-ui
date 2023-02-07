import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const videoPlugin: Plugin = {
  tag: 'plugin/video',
  name: 'Video',
  config: {
    type: 'viewer',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`🎞️`}],
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

export const videoExtensions = ['.3gp', '.mpg', '.mpeg', '.mp4', '.m4v', '.m4p', '.webm', '.ogv', '.m3u8', '.mov'];

export function isVideo(url: string) {
  return videoExtensions.includes(url.slice(url.lastIndexOf('.')).toLowerCase());
}
