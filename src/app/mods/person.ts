import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';

export const personPlugin: Plugin = {
  tag: 'plugin/person',
  name: $localize`📇️‍ Person`,
  config: {
    type: 'semantic',
    add: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Adds filtering and stylizing to support people semantics.`,
    published: $localize`born`,
    icons: [{ label: $localize`📇️`, order: 2 }],
    submit: $localize`📇️ person`,
    filters: [
      { query: 'plugin/person', label: $localize`📇️‍ people`, title: $localize`Contacts`, group: $localize`Plugins 🧰️` },
    ],
    // language=CSS
    css: `
      .plugin_person .thumbnail {
        border-radius: 24px !important;
        height: 48px !important;
        background-size: cover !important;
      }
    `,
  },
};
