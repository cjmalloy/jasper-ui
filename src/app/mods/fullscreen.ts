import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const fullscreenPlugin: Plugin = {
  tag: 'plugin/fullscreen',
  name: $localize`⛶ Fullscreen`,
  config: {
    type: 'plugin',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Fullscreen the viewer when shown. If optional is set the viewer
    may be shown if fullscreen is not available or the user has cancelled fullscreen.`,
    icons: [{ thumbnail: $localize`⛶`, order: -1 }],
    advancedForm: [{
      key: 'optional',
      type: 'boolean',
      props: {
        label: $localize`Optional: `,
      },
    }, {
      key: 'onload',
      type: 'boolean',
      props: {
        label: $localize`On Load: `,
      },
    }],
  },
  schema: {
    optionalProperties: {
      optional: { type: 'boolean' },
      onload: { type: 'boolean' },
    },
  },
};

export const fullscreenMod: Mod = {
  plugin: [
    fullscreenPlugin,
  ]
};
