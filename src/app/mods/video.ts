import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const videoPlugin: Plugin = {
  tag: 'plugin/video',
  name: $localize`🎞️ Video`,
  config: {
    type: 'plugin',
    default: true,
    proxy: true,
    add: true,
    embeddable: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    submit: $localize`🎞️ video`,
    icons: [{ label: $localize`🎞️`, order: 2 }],
    filters: [
      { query: 'plugin/video', label: $localize`🎞️ video`, title: $localize`Videos`, group: $localize`Media 🎬️` },
    ],
    extensions: ['.3gp', '.mpg', '.mpeg', '.mp4', '.m4v', '.m4p', '.webm', '.ogv', '.m3u8', '.mov'],
    description: $localize`Play in a video player.`,
    advancedForm: [{
      key: 'url',
      type: 'video',
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

export const videoMod: Mod = {
  plugin: [
    videoPlugin,
  ],
};
