import { omit } from 'lodash-es';
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
      app-ref-list.plugin_image {
        .list-container {
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
  defaults: omit(imageTemplate.defaults, 'defaultCols'),
};

export const masonryMod: Mod = {
  template: [
    masonryTemplate,
  ],
};
