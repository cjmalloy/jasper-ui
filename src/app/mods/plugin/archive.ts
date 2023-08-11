import * as moment from 'moment';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { getHost, getScheme } from '../../util/hosts';

export const archivePlugin: Plugin = {
  tag: 'plugin/archive',
  name: $localize`🗄️ Archive`,
  config: {
    type: 'viewer',
    default: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`🗄️`}],
    filters: [
      { query: 'plugin/archive', label: $localize`🗄️ archive`, group: $localize`Plugins 🧰️` },
    ],
    hosts: [
      'archive.ph',
      '12ft.io',
    ],
    defaultArchive: 'https://archive.ph/newest/',
    // defaultArchive: 'https://12ft.io/?proxy=',
    advancedForm: [{
      key: 'url',
      type: 'url',
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

export function findArchive(plugin: Plugin, ref?: Ref) {
  if (!ref) return null;
  if (ref.alternateUrls && plugin!.config?.hosts) {
    for (const s of ref.alternateUrls) {
      if (plugin!.config.hosts.includes(getHost(s)!)) return s;
    }
  }
  const scheme = getScheme(ref.url);
  if (scheme !== 'http:' && scheme !== 'https:') return null;
  return plugin!.config!.defaultArchive + ref.url;
}