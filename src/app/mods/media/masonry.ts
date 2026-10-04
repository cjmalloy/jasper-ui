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
        @supports (grid-template-rows: masonry) {
          grid-template-rows: masonry;
          align-items: start;
        }
        @supports (display: grid-lanes) {
          display: grid-lanes;
          align-items: start;
        }
        @supports not ((grid-template-rows: masonry) or (display: grid-lanes)) {
          display: block;
          column-width: 300px;
          column-gap: 8px;
          .ref {
            display: block;
            width: 100%;
            break-inside: avoid;
            margin: 0 0 8px 0;
          }
        }
      }
    `,
  },
};

export const masonryMod: Mod = {
  template: [
    masonryTemplate,
  ],
};
