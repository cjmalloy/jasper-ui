import { DateTime } from 'luxon';
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const experimentsConfig: Template = {
  tag: 'experiments',
  name: $localize`🧪️ Experiments`,
  config: {
    mod: $localize`🧪️ Experiments`,
    type: 'config',
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Show experimental plugins on setup page`,
  }
};

export const experimentsMod: Mod = {
  template: [
    experimentsConfig,
  ]
};
