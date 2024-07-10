import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';
import { chessPlugin, chessTemplate } from './chess';

export const cachePlugin: Plugin = {
  tag: '_plugin/cache',
  name: $localize`🗜️ Cache`,
  config: {
    mod: $localize`🗜️ Cache`,
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
    settings: $localize`cache`,
    submit: $localize`🗜️ cache`,
    internal: true,
    icons: [{ label: $localize`🗜️`, order: -10 }],
    filters: [
      { query: '_plugin/cache', label: $localize`🗜️ cache`, group: $localize`Plugins 🧰️` },
    ],
    description: $localize`Cache remote resources locally.
    If you delete a Ref it's cached file will not be removed from storage right away.
    If you restore a Ref before the cache is cleared you also recover the cached file.
    Clicking "empty recycle bin" will immediately free up storage space.`,
    hasClearCache: $localize`🗑️ purge deleted from storage`,
    clearCacheConfirm: $localize`Warning!
This is very slow and expensive if you have a large cache.

Files which have only had their Ref deleted can still be recovered, but after this they will be permanently deleted.

Are you sure you want to purge deleted files from storage?`,
    actions: [{ event: 'scrape', label: $localize`scrape` }],
    // language=HTML
    snippet: `
      <script>
        Handlebars.registerHelper('readableBytes', (size) => {
          const i = !size ? 0 : Math.floor(Math.log(size) / Math.log(1024));
          return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
        });
      </script>
    `,
    // language=Handlebars
    infoUi: `{{#if contentLength}}<span title="{{mimeType}}">{{readableBytes contentLength}}</span>{{/if}}`,
    form: [{
      key: 'id',
      type: 'string',
      props: {
        label: $localize`Cache ID:`,
      }
    }, {
      key: 'mimeType',
      type: 'string',
      props: {
        label: $localize`Mime Type:`,
      }
    }, {
      key: 'contentLength',
      type: 'number',
      props: {
        label: $localize`Content Length:`,
      }
    }, {
      key: 'ban',
      type: 'boolean',
      props: {
        label: $localize`Banned:`,
      }
    }, {
      key: 'noStore',
      type: 'boolean',
      props: {
        label: $localize`Proxy Only:`,
        title: $localize`Do not store file, but allow fetching as a proxy.`,
      }
    }, {
      key: 'thumbnail',
      type: 'boolean',
      props: {
        label: $localize`Thumbnail:`,
      }
    }],
  },
  schema: {
    optionalProperties: {
      id: { type: 'string' },
      mimeType: { type: 'string' },
      contentLength: { type: 'uint32' },
      ban: { type: 'boolean' },
      noStore: { type: 'boolean' },
      thumbnail: { type: 'boolean' },
    }
  }
};

export const asyncCachePlugin: Plugin = {
  tag: '_plugin/delta/cache',
  name: $localize`🗜️ Async Cache`,
  config: {
    mod: $localize`🗜️ Cache`,
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
    icons: [{ label: $localize`⏳️`, order: -10 }],
    actions: [{ tag: '_plugin/delta/cache', labelOn: $localize`cancel` }],
  },
};

export const cacheMod: Mod = {
  plugins: {
    cachePlugin,
    asyncCachePlugin,
  },
};
