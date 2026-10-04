import { Mod } from '../../model/tag';
import { Template } from '../../model/template';

export const masonryTemplate: Template = {
  tag: 'plugin/image/masonry',
  name: $localize`🧱️ Masonry`,
  config: {
    mod: $localize`🧱️ Masonry`,
    version: 1,
    type: 'plugin',
    default: false,
    description: $localize`Overrides the built-in Image viewer with a masonry layout where images have a fixed width and variable height.`,
    // language=CSS
    css: `
      body app-ref-list.plugin_image .list-container {
        grid-template-rows: masonry;
        align-items: start;
      }
    `,
  },
};

export const masonryMod: Mod = {
  template: [
    masonryTemplate,
  ],
};
