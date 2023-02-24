import * as Handlebars from 'handlebars';
import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';

// https://github.com/handlebars-lang/handlebars.js/issues/1593
// @ts-ignore
window.global = {};

Handlebars.registerHelper('userVoted', (ref: Ref, value: string) => {
  return ref.metadata?.userUrls?.includes('plugin/poll.' + value);
});

Handlebars.registerHelper('votePercentage', (ref: Ref, value: string) => {
  const total =
    (ref.metadata?.plugins?.['plugin/poll.a'] || 0) +
    (ref.metadata?.plugins?.['plugin/poll.b'] || 0) +
    (ref.metadata?.plugins?.['plugin/poll.c'] || 0) +
    (ref.metadata?.plugins?.['plugin/poll.d'] || 0);
  if (!total) return 0;
  return Math.floor(100 * (ref.metadata?.plugins?.['plugin/poll.' + value] || 0) / total);
});

export const pollPlugin: Plugin = {
  tag: 'plugin/poll',
  name: $localize`🗳️ Poll`,
  config: {
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Create a multiple choice poll and view the results.`,
    icons: [
      { label: $localize`🗳️` },
    ],
    submitInternal: $localize`🗳️ poll`,
    actions: [
      { condition: 'a', response: 'plugin/poll.a', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`a`, labelOn: $localize`(a)` },
      { condition: 'b', response: 'plugin/poll.b', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`b`, labelOn: $localize`(b)` },
      { condition: 'c', response: 'plugin/poll.c', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`c`, labelOn: $localize`(c)` },
      { condition: 'd', response: 'plugin/poll.d', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`d`, labelOn: $localize`(d)` },
    ],
    filters: [
      { query: 'plugin/poll', label: $localize`🗳️ poll`, group: $localize`Plugins 🧰️` },
    ],
    css: `
      .poll-results {
        display: inline-block !important;
        padding: 10px;
      }
      .poll-results > div {
        display: inline-block;
        position: relative;
        min-width: min(100vw, 300px);
      }
      .poll-results > div > div {
        box-sizing: border-box;
        min-width: 20px;
        margin: 2px;
        padding: 4px;
        white-space: nowrap;
        overflow: visible;
        border-radius: 6px;
        background-color: rgba(128, 128, 128, 0.5);
      }
      .poll-results .voted:after {
        content: ' ☑️ ';
      }
    `,
    ui: `
      <div class="bubble poll-results">
        <div>
          {{#if a }}<div {{#if (userVoted ref 'a')}} class="voted" {{/if}} style="width: {{ votePercentage ref 'a' }}%">A: {{ a }} {{ votePercentage ref 'a' }}%</div>{{/if}}
          {{#if b }}<div {{#if (userVoted ref 'b')}} class="voted" {{/if}} style="width: {{ votePercentage ref 'b' }}%">B: {{ b }} {{ votePercentage ref 'b' }}%</div>{{/if}}
          {{#if c }}<div {{#if (userVoted ref 'c')}} class="voted" {{/if}} style="width: {{ votePercentage ref 'c' }}%">C: {{ c }} {{ votePercentage ref 'c' }}%</div>{{/if}}
          {{#if d }}<div {{#if (userVoted ref 'd')}} class="voted" {{/if}} style="width: {{ votePercentage ref 'd' }}%">D: {{ d }} {{ votePercentage ref 'd' }}%</div>{{/if}}
        </div>
      </div>
    `,
    form: [{
      key: 'a',
      type: 'input',
      props: {
        label: $localize`Option A:`,
      },
    }, {
      key: 'b',
      type: 'input',
      props: {
        label: $localize`Option B:`,
      },
    }, {
      key: 'c',
      type: 'input',
      props: {
        label: $localize`Option C:`,
      },
    },{
      key: 'd',
      type: 'input',
      props: {
        label: $localize`Option D:`,
      },
    }],
  },
  schema: {
    optionalProperties: {
      a: { type: 'string' },
      b: { type: 'string' },
      c: { type: 'string' },
      d: { type: 'string' },
    },
  },
};

export const pollOptionAPlugin: Plugin = {
  tag: 'plugin/poll.a',
  name: $localize`🎫️ Poll Option A`,
  config: {
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const pollOptionBPlugin: Plugin = {
  tag: 'plugin/poll.b',
  name: $localize`🎫️ Poll Option B`,
  config: {
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const pollOptionCPlugin: Plugin = {
  tag: 'plugin/poll.c',
  name: $localize`🎫️ Poll Option C`,
  config: {
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const pollOptionDPlugin: Plugin = {
  tag: 'plugin/poll.d',
  name: $localize`🎫️ Poll Option D`,
  config: {
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};
