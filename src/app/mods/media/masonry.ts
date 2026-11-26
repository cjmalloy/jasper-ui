import { Mod } from '../../model/tag';
import { Template } from '../../model/template';

export const masonryTemplate: Template = {
  tag: 'plugin/image/masonry',
  name: $localize`🧱️ Masonry`,
  config: {
    mod: $localize`🧱️ Masonry`,
    version: 6,
    type: 'plugin',
    default: false,
    description: $localize`Overrides the built-in Image viewer with a masonry layout where images have a fixed width and variable height.`,
    // language=CSS
    css: `
      body app-ref-list.plugin_image .list-container {
        grid-auto-flow: row;
        & > .ref {
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
        }
      }
      /* Without grid-lanes, the list sets --masonry-span to the number of rows each ref covers.
         Refs are placed in order, so loading more refs never moves the ones above. */
      @supports not (display: grid-lanes) {
        body app-ref-list.plugin_image .list-container {
          --masonry-row: 4px;
          grid-auto-rows: var(--masonry-row);
          row-gap: 0;
          align-items: start;
          & > .ref {
            --masonry-row: initial;
            grid-row-end: span var(--masonry-span, 1);
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
          /* Anchored overlays are laid out on every list layout, so only show them for the active ref */
          &:not(:hover, .mobile-unlock) {
            & > .voting, & > .link, & > .info, & > .actions, &::after {
              display: none;
            }
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
            flex-wrap: nowrap;
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
