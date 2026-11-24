import { Mod } from '../../model/tag';
import { Template } from '../../model/template';

export const infiniteTemplate: Template = {
  tag: 'plugin/image/infinite',
  name: $localize`♾️ Infinite Scroll`,
  config: {
    mod: $localize`♾️ Infinite Scroll`,
    version: 1,
    type: 'plugin',
    default: false,
    description: $localize`Loads more images in the built-in Image viewer as you scroll down, instead of paging.`,
  },
};

export const infiniteMod: Mod = {
  template: [
    infiniteTemplate,
  ],
};
