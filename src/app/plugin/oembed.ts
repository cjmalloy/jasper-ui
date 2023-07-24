import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const oEmbedPlugin: Plugin = {
  tag: '+plugin/oembed',
  name: '📡️ oEmbed',
  config: {
    type: 'core',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    settings: $localize`oembed`,
    icons: [{ label: $localize`📡️`}],
    description: $localize`Register an oEmbed API.`,
    hasDefaults: true,
    form: [{
      key: 'provider_name',
      type: 'string',
    }, {
      key: 'provider_url',
      type: 'url',
    }, {
      key: 'endpoints',
      type: 'list',
      props: {
        label: $localize`Endpoints:`,
        addText: $localize`+ Add endpoint`,
      },
      fieldArray: {
        fieldGroup: [{
          key: 'url',
          type: 'url',
        }, {
          key: 'discovery',
          type: 'boolean',
          props: {
            label: $localize`Discovery:`
          }
        }, {
          key: 'schemes',
          type: 'urls',
          props: {
            label: $localize`Schemes:`,
            addText: $localize`+ Add scheme`
          },
          fieldArray: {
            props: {
              label: $localize`🔗️*`,
            }
          },
        }, {
          key: 'formats',
          type: 'list',
          props: {
            label: $localize`Formats:`,
            addText: $localize`+ Add format`
          },
          fieldArray: {
            type: 'string',
          }
        }]
      }
    }]
  },
  schema: {
    optionalProperties: {
      provider_name: { type: 'string' },
      provider_url: { type: 'string' },
      endpoints: { elements: {
          optionalProperties: {
            url: { type: 'string' },
            discovery: { type: 'boolean' },
            schemes: { elements: { type: 'string' } },
            formats: { elements: { type: 'string' } },
          },
        },
      },
    },
  }
};
