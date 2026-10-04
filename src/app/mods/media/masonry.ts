import { Mod } from '../../model/tag';
import { Template } from '../../model/template';
import { imageTemplate } from './image';

export const masonryTemplate: Template = {
  ...imageTemplate,
  name: $localize`🧱️ Masonry`,
  config: {
    ...imageTemplate.config,
    mod: $localize`🧱️ Masonry`,
    version: 1000 + imageTemplate.config!.version!,
    default: false,
    description: $localize`Replaces the built-in Image viewer with a masonry layout where images have a fixed width and variable height.`,
    // language=CSS
    css: imageTemplate.config!.css + `
      app-ref-list.plugin_image .list-container {
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
