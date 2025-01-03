import { DateTime } from 'luxon';
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const graphConfig: Template = {
  tag: 'graph',
  name: $localize`🎇️ Graph`,
  config: {
    mod: $localize`🎇️ Graph`,
    type: 'lens',
    experimental: true,
    global: true,
    view: $localize`graph`,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Activates built-in graph support and allows users to create graphs.`,
  },
};

export const graphMod: Mod = {
  template: [
    graphConfig,
  ]
};
