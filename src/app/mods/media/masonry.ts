import { Mod } from '../../model/tag';
import { Template } from '../../model/template';

export const masonryTemplate: Template = {
  tag: 'plugin/image/masonry',
  name: $localize`🧱️ Masonry`,
  config: {
    mod: $localize`🧱️ Masonry`,
    version: 3,
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
      /* Take hover overlays out of the flow so short images keep their natural height */
      @supports (anchor-scope: all) {
        body app-ref-list.plugin_image .list-container > .ref {
          anchor-scope: --masonry-link, --masonry-info, --masonry-actions;
          & > .voting, & > .link, & > .info, & > .actions, &::after {
            position: absolute;
            grid-area: auto;
          }
          & > .link, & > .info, & > .actions, &::after {
            left: 0;
            right: 0;
          }
          & > .voting {
            top: 0;
            left: 0;
          }
          & > .link {
            top: 0;
            anchor-name: --masonry-link;
          }
          & > .info {
            top: anchor(--masonry-link bottom);
            anchor-name: --masonry-info;
          }
          & > .actions {
            top: anchor(--masonry-info bottom);
            anchor-name: --masonry-actions;
          }
          &::after {
            top: 0;
            bottom: calc(anchor(--masonry-actions bottom) - 14px);
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
