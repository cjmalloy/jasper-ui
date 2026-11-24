import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const infiniteConfig: Template = {
  tag: 'config/infinite',
  name: $localize`♾️ Infinite Scroll`,
  config: {
    mod: $localize`♾️ Infinite Scroll`,
    version: 1,
    type: 'config',
    default: false,
    description: $localize`Load more results as you scroll down lists, instead of paging.`,
  },
};

export const infiniteMod: Mod = {
  template: [
    infiniteConfig,
  ],
};
