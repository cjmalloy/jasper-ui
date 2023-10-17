import { $localize } from '@angular/localize/init';
import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';

export const imagePlugin: Plugin = {
  tag: 'plugin/image',
  name: $localize`🖼️ Image`,
  config: {
    type: 'plugin',
    mod: $localize`🖼️ Images`,
    default: true,
    cache: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submit: $localize`🖼️ image`,
    icons: [{ label: $localize`🖼️`, order: 2 }],
    filters: [
      { query: 'plugin/image', label: $localize`🖼️ image`, group: $localize`Plugins 🧰️` },
    ],
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
    description: $localize`Display the image inline.`,
    advancedForm: [{
      key: 'url',
      type: 'image',
      props: {
        label: $localize`URL: `,
      },
    }, {
      key: 'width',
      type: 'number',
      props: {
        label: $localize`Width: `,
      },
    }, {
      key: 'height',
      type: 'number',
      props: {
        label: $localize`Height: `,
      },
    }],
  },
  schema: {
    optionalProperties: {
      url: { type: 'string' },
      width: { type: 'uint16' },
      height: { type: 'uint16' },
    },
  },
};

export const imageTemplate: Template = {
  tag: 'plugin/image',
  name: $localize`🖼️ Images`,
  config: {
    mod: $localize`🖼️ Images`,
    type: 'plugin',
    default: true,
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
    view: $localize`🖼️`,
    description: $localize`Activates built-in Image viewer mode for viewing Refs.`,
    // language=CSS
    css: `
      app-ref-list.plugin-image {
        .list-container {
          grid-auto-flow: row dense;
          margin: 4px;
          gap: 8px;
          grid-template-columns:  1fr;
          @media (min-width: 1000px) {
            grid-template-columns:  1fr 1fr;
          }
          @media (min-width: 1500px) {
            grid-template-columns: 1fr 1fr 1fr;
          }
          @media (min-width: 2000px) {
            grid-template-columns: 1fr 1fr 1fr 1fr;
          }
          .list-number {
            display: none;
          }
          .ref {
            position: relative;
            margin: 0;
            padding: 0;
            .image-expand {
              position: relative;
              min-width: 100%;
              min-height: 100%;
              border-radius: 7px;
              overflow: hidden;
              margin: 0;
              padding: 0;
            }
            & > .row {
              display: none;
              position: absolute;
              top: 6px;
              left: 6px;
              overflow: hidden;
              padding: 8px;
              border-radius: 8px;
              z-index: 2;
            }
            &:hover > .row {
              display: block;
            }
            &:focus-within > .row:not(:focus-within) {
              display: none;
            }
            &.mobile-unlock > .row {
              display: block !important;
            }
            .toggle,
            .thumbnail {
              display: none;
            }
            @media (max-width: 740px) {
              .actions, .info {
                height: 28px;
              }
            }
          }
        }
      }
      body.dark-theme app-ref-list.plugin-image {
        .list-container .ref > .row {
          backdrop-filter: grayscale(1) contrast(0.4) brightness(0.4) blur(8px);
          border: 0.5px solid rgba(255, 255, 255, 0.2);
        }
        .list-container .ref .image-expand {
          backdrop-filter: grayscale(1) brightness(0.9) blur(0.5px);
        }
      }
      body.light-theme app-ref-list.plugin-image {
        .list-container .ref > .row {
          backdrop-filter: grayscale(1) contrast(0.3) brightness(1.5) blur(8px);
        }
        .list-container .ref .image-expand {
          backdrop-filter: grayscale(1) brightness(0.9) blur(0.5px);
        }
      }
    `,
  },
  defaults: {
    defaultExpanded: true,
    hideEdit: true,
    disableResize: true,
    defaultCols: 0, // Leave to CSS screen size detection, but show cols dropdown
  }
};
