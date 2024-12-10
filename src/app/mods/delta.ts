import { $localize } from '@angular/localize/init';
import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const deltaPlugin: Plugin = {
  tag: 'plugin/delta',
  name: $localize`⏳️ Delta`,
  config: {
    default: true,
    mod: $localize`⏳️ Delta`,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Transform Refs by running scripts.`,
    icons: [
      { label: $localize`⏳️`, noResponse: '+plugin/delta', order: -10 },
      { tag: '_plugin/delta', label: $localize`⏳️`, noResponse: '+plugin/delta', order: -10 },
    ],
    filters: [{ query: 'plugin/delta|_plugin/delta', label: $localize`⏳️ Working`, title: $localize`Running a script`, group: $localize`Plugins 🧰️` }],
  },
};

export const deltaSignaturePlugin: Plugin = {
  tag: '+plugin/delta',
  name: $localize`⏳️ Delta Signature`,
  config: {
    default: true,
    mod: $localize`⏳️ Delta`,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Transform Refs by running scripts.`,
  },
  generateMetadata: true,
};

export const deltaMod: Mod = {
  plugin: [
    deltaPlugin,
    deltaSignaturePlugin,
  ],
};
