import { Mod } from '../../model/tag';
import { Template } from '../../model/template';

export const masonryTemplate: Template = {
  tag: 'plugin/image/masonry',
  name: $localize`🧱️ Masonry`,
  config: {
    mod: $localize`🧱️ Masonry`,
    version: 2,
    type: 'plugin',
    default: false,
    description: $localize`Overrides the built-in Image viewer with a masonry layout where images have a fixed width and variable height.`,
    // language=CSS
    css: `
      body app-ref-list.plugin_image .list-container {
        display: block;
        column-gap: 8px;
        column-count: 1;
        @media (min-width: 1000px) {
          column-count: 2;
        }
        @media (min-width: 1500px) {
          column-count: 3;
        }
        @media (min-width: 2000px) {
          column-count: 4;
        }
        &.hide-numbers {
          column-count: var(--cols);
        }
        & > .ref {
          break-inside: avoid;
          margin-bottom: 8px;
          .image-expand {
            min-height: 0;
          }
        }
      }
      @supports (display: grid-lanes) {
        body app-ref-list.plugin_image .list-container {
          display: grid-lanes;
          & > .ref {
            margin-bottom: 0;
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
