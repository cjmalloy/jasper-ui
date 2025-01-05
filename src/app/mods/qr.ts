import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const qrPlugin: Plugin = {
  tag: 'plugin/qr',
  name: $localize`🔲 QR Code`,
  config: {
    type: 'plugin',
    add: true,
    embeddable: true,
    submit: $localize`🔲 qr`,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Scan or upload a QR Code`,
    icons: [{ label: $localize`🔲` }],
    filters: [
      { query: 'plugin/qr', label: $localize`🔲 qr`, title: $localize`Has QR code`, group: $localize`Plugins 🧰️` },
    ],
    advancedForm: [{
      key: 'url',
      type: 'qr',
      props: {
        label: $localize`URL:`,
      },
    }],
  },
  defaults: {},
  schema: {
    optionalProperties: {
      url: { type: 'string' },
    },
  },
};

export const qrMod: Mod = {
  plugin: [
    qrPlugin,
  ]
};
