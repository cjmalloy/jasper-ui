import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const embedPlugin: Plugin = {
  tag: 'plugin/embed',
  name: $localize`🔭️ Embed`,
  config: {
    type: 'plugin',
    default: true,
    add: true,
    embeddable: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    submit: $localize`🔭️ embed`,
    icons: [{ label: $localize`🔭️` }],
    filters: [
      { query: 'plugin/embed', label: $localize`🔭️ embed`, title: $localize`Has embedded iframe`, group: $localize`Plugins 🧰️` },
    ],
    description: $localize`Embed the webpage in an inline frame.`,
    advancedForm: [{
      key: 'url',
      type: 'url',
      props: {
        label: $localize`URL:`,
      },
    }, {
      key: 'width',
      type: 'number',
      props: {
        label: $localize`Width:`,
        min: 50,
      },
      validation: {
        messages: {
          min: 'Width must be at least 200px.'
        }
      }
    }, {
      key: 'height',
      type: 'number',
      props: {
        label: $localize`Height:`,
        min: 50
      },
      validation: {
        messages: {
          min: 'Height must be at least 200px.'
        }
      }
    }, {
      key: 'resize',
      type: 'boolean',
      props: {
        label: $localize`Resizeable:`
      }
    }],
  },
  defaults: {},
  schema: {
    optionalProperties: {
      url: { type: 'string' },
      resize: { type: 'boolean' },
      width: { type: 'int32', nullable: true },
      height: { type: 'int32', nullable: true },
    },
  },
};

export const embedMod: Mod = {
  plugin: [
    embedPlugin,
  ]
};
