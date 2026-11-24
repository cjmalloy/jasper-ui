import { Mod } from '../../model/tag';
import { Template } from '../../model/template';

export const masonryTemplate: Template = {
  tag: 'plugin/image/masonry',
  name: $localize`🧱️ Masonry`,
  config: {
    mod: $localize`🧱️ Masonry`,
    version: 4,
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
            &.loading {
              height: auto;
              aspect-ratio: 1;
            }
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
        body app-ref-list.plugin_image .list-container {
          position: relative;
        }
        body app-ref-list.plugin_image .list-container > .ref {
          /* Position overlays against the list so they can overflow the ref and flip at the list edge */
          position: static;
          anchor-name: --masonry-ref;
          anchor-scope: --masonry-ref, --masonry-link, --masonry-info, --masonry-actions;
          & > .voting, & > .link, & > .info, & > .actions, &::after {
            position: absolute;
            grid-area: auto;
          }
          & > .voting {
            top: anchor(--masonry-ref top);
            left: anchor(--masonry-ref left);
          }
          & > .link {
            top: anchor(--masonry-ref top);
            left: anchor(--masonry-ref left);
            right: anchor(--masonry-ref right);
            anchor-name: --masonry-link;
          }
          /* Keep info and actions on one line, overflowing right, or left if there is no room */
          & > .info, & > .actions {
            left: anchor(--masonry-ref left);
            min-width: calc(anchor-size(--masonry-ref width) - 28px);
            white-space: nowrap;
            overflow: visible;
            position-try-fallbacks: flip-inline;
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
            top: anchor(--masonry-ref top);
            bottom: calc(anchor(--masonry-actions bottom) - 14px);
            left: min(anchor(--masonry-ref left), calc(anchor(--masonry-info left) - 14px), calc(anchor(--masonry-actions left) - 14px));
            right: min(anchor(--masonry-ref right), calc(anchor(--masonry-info right) - 14px), calc(anchor(--masonry-actions right) - 14px));
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
