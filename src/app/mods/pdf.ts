import moment from 'moment';
import { Plugin } from '../model/plugin';
import { findExtension, Ref } from '../model/ref';

export const pdfPlugin: Plugin = {
  tag: 'plugin/pdf',
  name: $localize`📄️ PDF`,
  config: {
    mod: $localize`📄️ PDF`,
    type: 'plugin',
    default: true,
    cache: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Adds an action button to open the PDF version.`,
    submit: `📄️ pdf`,
    icons: [{ label: $localize`📄️`, order: 2 }],
    filters: [
      { query: 'plugin/pdf', label: $localize`📄️ pdf`, group: $localize`Plugins 🧰️` },
    ],
    actions: [{ label: $localize`pdf`, event: 'pdf' }],
    extensions: ['.pdf'],
    advancedForm: [{
      key: 'url',
      type: 'url',
      props: {
        label: $localize`URL:`,
      },
    }, {
      key: 'showAbstract',
      type: 'boolean',
      props: {
        label: $localize`Show Abstract:`,
      },
    }],
  },
  defaults: {},
  schema: {
    optionalProperties: {
      url: { type: 'string' },
      showAbstract: { type: 'boolean' },
    },
  },
};


export function pdfUrl(plugin?: typeof pdfPlugin, ref?: Ref, repost?: Ref) {
  return ref?.plugins?.['plugin/pdf']?.url
    || repost?.plugins?.['plugin/pdf']?.url
    || findExtension('.pdf', ref, repost);
}

export const pdfResizePlugin: Plugin = {
  tag: 'plugin/pdf/resize',
  name: $localize`📄️ PDF Resize handle`,
  config: {
    mod: $localize`📄️ PDF`,
    description: $localize`Adds an action button to open the PDF version.`,
  }
}
