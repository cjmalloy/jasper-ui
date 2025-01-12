import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const feedPlugin: Plugin = {
  tag: 'plugin/feed',
  name: $localize`🗞️ RSS/Atom Feed`,
  config: {
    default: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    submit: $localize`🗞️ feed`,
    settings: $localize`feeds`,
    icons: [
      { label: $localize`🗞️`, order: 3 },
      { tag: '-+plugin/cron',  label: $localize`🚫️`, title: $localize`Pulling disabled`, order: -1 },
    ],
    description: $localize`Import entries from an RSS / Atom feed. The feed will be scraped on an interval you specify.`,
    actions: [
      { response: '+plugin/run', labelOn: $localize`cancel`, labelOff: $localize`pull`, title: $localize`Scrape the feed and add any new Refs.`, confirm: $localize`Are you sure you want to pull?` },
      { tag: '+plugin/cron', labelOn: $localize`disable`, labelOff: $localize`enable`, title: $localize`Schedule this feed to pull every 15 minutes.` },
    ],
    // language=Handlebars
    infoUi: `
      {{#if (interestingTags addTags)}} tagging refs {{/if}}
      {{#each (interestingTags addTags)}}
        #{{.}}
      {{/each}}`,
    form: [{
      key: 'addTags',
      type: 'tags',
    }],
    advancedForm: [{
      key: 'disableEtag',
      type: 'boolean',
      props: {
        label: $localize`Disable Etag Caching:`
      }
    }, {
      key: 'stripQuery',
      type: 'boolean',
      props: {
        label: $localize`Strip Query:`
      }
    }, {
      key: 'scrapeWebpage',
      type: 'boolean',
      props: {
        label: $localize`Scrape Webpage:`
      }
    }, {
      key: 'scrapeDescription',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Scrape Description:`
      }
    }, {
      key: 'scrapeContents',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Scrape Contents:`,
        title: $localize`Will overwrite description if both scraped and found.`
      }
    }, {
      key: 'scrapeAuthors',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Scrape Authors:`
      }
    }, {
      key: 'scrapeThumbnail',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Scrape Thumbnail:`
      }
    }, {
      key: 'scrapeAudio',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Scrape Audio:`
      }
    }, {
      key: 'scrapeVideo',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Scrape Video:`
      }
    }, {
      key: 'scrapeEmbed',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Scrape Embed:`
      }
    }]
  },
  schema: {
    optionalProperties: {
      addTags: { elements: { type: 'string' } },
      disableEtag: { type: 'boolean' },
      etag: { type: 'string' },
      stripQuery: { type: 'boolean' },
      scrapeWebpage: { type: 'boolean' },
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

export const feedMod: Mod = {
  plugin: [
    feedPlugin,
  ]
};
