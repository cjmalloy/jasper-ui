import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const feedPlugin: Plugin = {
  tag: '+plugin/feed',
  name: $localize`🗞️ RSS/Atom Feed`,
  config: {
    type: 'core',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submit: $localize`🗞️ feed`,
    settings: $localize`feed`,
    icons: [{ label: $localize`🗞️` }],
    description: $localize`Import entries from an RSS / Atom feed. The feed will be scraped on an interval you specify.`,
    actions: [{ event: 'scrape', label: $localize`scrape` }],
    infoUi: `
      {{#if lastScrape}}
        last scraped {{fromNow lastScrape}}
      {{else}}
        not scraped yet
      {{/if}}
    `,
  },
  defaults: {
    scrapeInterval: 'PT15M',
  },
  schema: {
    properties: {
      scrapeInterval: { type: 'string' },
    },
    optionalProperties: {
      addTags: { elements: { type: 'string' } },
      lastScrape: { type: 'string' },
      disableEtag: { type: 'boolean' },
      etag: { type: 'string' },
      scrapeDescription: { type: 'boolean' },
      scrapeContents: { type: 'boolean' },
      scrapeAuthors: { type: 'boolean' },
      scrapeThumbnail: { type: 'boolean' },
      scrapeAudio: { type: 'boolean' },
      scrapeVideo: { type: 'boolean' },
      scrapeEmbed: { type: 'boolean' },
    },
  },
};
