import { $localize } from '@angular/localize/init';
import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';

export const lensPlugin: Plugin = {
  tag: 'plugin/lens',
  name: $localize`🪞 Lens`,
  config: {
    type: 'plugin',
    mod: $localize`🪞 Lenses`,
    default: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Embed a Lens in a Ref`,
    icons: [{ label: $localize`🪞`, order: 1 }],
    filters: [
      { query: 'plugin/lens', label: $localize`🪞 lens`, group: $localize`Plugins 🧰️` },
    ],
    advancedForm: [{
      key: 'url',
      type: 'url',
      props: {
        label: $localize`URL: `,
      },
    }],
  },
  schema: {
    optionalProperties: {
      url: { type: 'string' },
    },
  },
};

export const lensTemplate: Template = {
  tag: 'plugin/lens',
  name: $localize`🪞 Lenses`,
  config: {
    mod: $localize`🪞 Lenses`,
    type: 'plugin',
    default: true,
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
    view: $localize`🪞`,
    description: $localize`Activates built-in Lens viewer mode for viewing Refs.`,
    // language=CSS
    css: `
      app-ref-list.plugin-lens {
        .list-container {
          grid-auto-flow: row dense;
          padding: 4px;
          gap: 8px;
          grid-template-columns:  1fr;
          @media (min-width: 1500px) {
            grid-template-columns: 1fr 1fr;
          }
          @media (min-width: 3000px) {
            grid-template-columns: 1fr 1fr 1fr 1fr;
          }
          .list-number {
            display: none;
          }
          .ref {
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
    `,
  },
  defaults: {
    defaultExpanded: true,
    hideEdit: true,
    defaultCols: 2,
  }
};
