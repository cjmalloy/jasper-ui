import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';

export const deletePlugin: Plugin = {
  tag: 'plugin/delete',
  name: $localize`Delete Notice`,
  config: {
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`🗑️` }],
    filters: [
      { query: 'plugin/delete', label: $localize`🗑️ deleted`, group: $localize`Plugins 🧰️` },
    ],
  },
};

export function deleteNotice(ref: Ref): Ref {
  return {
    url: ref.url,
    origin: ref.origin,
    tags: ['plugin/delete', 'internal'],
    created: ref.created,
    published: ref.published,
    modifiedString: ref.modifiedString,
  };
}
