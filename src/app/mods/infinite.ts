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
    description: $localize`Load more results as you scroll down lists, instead of paging. Override per tag with the Infinite Scroll template setting, or per page with the infinite=true or infinite=false query param.`,
    /**
     * Enable infinite scroll on lists that do not override it.
     */
    defaultInfinite: true,
  },
};

export const infiniteMod: Mod = {
  template: [
    infiniteConfig,
  ],
};
