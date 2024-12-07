import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const filePlugin: Plugin = {
  tag: 'plugin/file',
  name: $localize`💾️️ File`,
  config: {
    default: true,
    mod: $localize`💾️️ File Cache`,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    icons: [{ label: $localize`💾️️`, order: 1 }],
    description: $localize`Allow storing user files on the server.`,
    filters: [
      { query: 'plugin/file', label: $localize`💾️️ file`, title: $localize`Uploaded Files`, group: $localize`Plugins 🧰️` },
    ],
  },
};

export const fileMod: Mod = {
  plugin: [
    filePlugin,
  ]
};
