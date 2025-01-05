import { DateTime } from 'luxon';
import { Mod } from '../model/tag';

export const hideMod: Mod = {
  plugin: [{
    tag: 'plugin/hide',
    name: $localize`🙈 Hide Refs`,
    config: {
      generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
      description: $localize`Mark Refs as hidden for the current user`,
      icons: [{ response: 'plugin/hide', label: $localize`🙈`, global: true, order: -1 }],
      filters: [
        { user: 'plugin/hide', label: $localize`🙈 hidden`, title: $localize`My hidden Refs`, group: $localize`Filters 🕵️️` },
      ],
      actions: [{ response: 'plugin/hide', labelOff: $localize`hide`, labelOn: $localize`unhide`, global: true }],
    },
    generateMetadata: true,
    userUrl: true,
  }],
};
