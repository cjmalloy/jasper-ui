import { $localize } from '@angular/localize/init';
import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { findExtensionOrCache, Ref } from '../model/ref';

export const pdfPlugin: Plugin = {
  tag: 'plugin/pdf',
  name: $localize`📄️ PDF`,
  config: {
    mod: $localize`📄️ PDF`,
    type: 'plugin',
    default: true,
    proxy: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Adds an action button to open the PDF version.`,
    submit: $localize`📄️ pdf`,
    icons: [{ label: $localize`📄️`, order: 2 }],
    filters: [
      { query: 'plugin/pdf', label: $localize`📄️ pdf`, title: $localize`PDFs`, group: $localize`Plugins 🧰️` },
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
  return ref?.plugins?.['plugin/pdf']?.url && { url: ref!.plugins?.['plugin/pdf'].url, origin: ref!.origin }
    || repost?.plugins?.['plugin/pdf']?.url && { url: repost!.plugins?.['plugin/pdf'].url, origin: repost!.origin }
    || findExtensionOrCache('.pdf', ref, repost);
}

export const pdfResizePlugin: Plugin = {
  tag: 'plugin/pdf/resize',
  name: $localize`📄️ PDF Resize handle`,
  config: {
    mod: $localize`📄️ PDF`,
    description: $localize`Adds an action button to open the PDF version.`,
  }
}
