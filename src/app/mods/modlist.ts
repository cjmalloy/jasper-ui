import * as moment from 'moment';
import { Template } from '../model/template';

export const modlistConfig: Template = {
  tag: '_moderated',
  name: $localize`🛡️ Modlist`,
  config: {
    type: 'config',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`This plugin marks posts as approved by a moderator. Adds a modlist tab to the inbox.`,
    icons: [
      { label: $localize`🛡️`, tag: '_moderated', title: $localize`Moderated`, order: -1 },
    ],
    actions: [
      { tag: '_moderated', labelOff: $localize`approve`, global: true, order: -1 }
    ],
    filters: [
      { query: '!_moderated', label: $localize`🛡️ modlist`, group: $localize`Mod Tools` },
    ],
  },
};

