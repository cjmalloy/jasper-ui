import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const infiniteConfig: Template = {
  tag: 'config/infinite',
  name: $localize`♾️ Infinite Scroll`,
  config: {
    mod: $localize`♾️ Infinite Scroll`,
    version: 2,
    type: 'config',
    default: false,
    description: $localize`Load more results as you scroll down lists, instead of paging. Override per tag with the Infinite Scroll template setting or defaultInfinite in a sub tag template default (such as plugin/image/masonry), or per page with the infinite=true or infinite=false query param.`,
    adminForm: [{
      key: 'defaultInfinite',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Enable by Default:`,
      },
    }],
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
