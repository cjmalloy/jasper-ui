import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';

export const qrPlugin: Plugin = {
  tag: 'plugin/qr',
  name: $localize`🔲 QR Code`,
  config: {
    type: 'plugin',
    add: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Activates built-in qr code support and allows users to create qr codes.`,
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
