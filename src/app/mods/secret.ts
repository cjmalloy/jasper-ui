import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

const secretPlugin: Plugin = {
  tag: '+plugin/secret',
  name: $localize`🔑️ Secret`,
  config: {
    mod: $localize`🔑️ Secret`,
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
    settings: $localize`secrets`,
    submit: $localize`🔑️ secret`,
    internal: true,
    genId: true,
    // TODO: submit as private
    icons: [{ label: $localize`🔑️`, order: 3 }],
    filters: [
      { query: '+plugin/secret', label: $localize`🔑️ secret`, group: $localize`Plugins 🧰️` },
    ],
    description: $localize`Store secrets with opaque protected tags.`,
  },
};

export const secretMod: Mod = {
  plugins: {
    system: secretPlugin,
  },
}
