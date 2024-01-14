import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';

export const pollPlugin: Plugin = {
  tag: 'plugin/poll',
  name: $localize`🗳️ Poll`,
  config: {
    mod: $localize`🗳️ Poll`,
    type: 'plugin',
    experimental: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Create a multiple choice poll and view the results.`,
    icons: [
      { label: $localize`🗳️`, title: `{{lookup . (maxCount ref 'plugin/poll.')}} {{percent ref (maxCount ref 'plugin/poll.') 'plugin/poll.'}}%` },
    ],
    submit: $localize`🗳️ poll`,
    genId: true,
    internal: true,
    actions: [
      { condition: 'a', response: 'plugin/poll.a', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`a`, labelOn: $localize`(a)`, title: `{{a}}: {{count ref 'plugin/poll.a'}} votes ({{percent ref 'a' 'plugin/poll.'}}%)` },
      { condition: 'b', response: 'plugin/poll.b', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`b`, labelOn: $localize`(b)`, title: `{{b}}: {{count ref 'plugin/poll.b'}} votes ({{percent ref 'b' 'plugin/poll.'}}%)` },
      { condition: 'c', response: 'plugin/poll.c', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`c`, labelOn: $localize`(c)`, title: `{{c}}: {{count ref 'plugin/poll.c'}} votes ({{percent ref 'c' 'plugin/poll.'}}%)` },
      { condition: 'd', response: 'plugin/poll.d', clear: ['plugin/poll.a', 'plugin/poll.b', 'plugin/poll.c', 'plugin/poll.d'], labelOff: $localize`d`, labelOn: $localize`(d)`, title: `{{d}}: {{count ref 'plugin/poll.d'}} votes ({{percent ref 'd' 'plugin/poll.'}}%)` },
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
    // language=Handlebars
    ui: `
      <div class="bubble poll-results">
        <div>
          {{#if a}}<div {{#if (response ref 'plugin/poll.a')}} class="voted" {{/if}} style="width: {{percent ref 'a' 'plugin/poll.'}}%">A: {{a}} {{percent ref 'a' 'plugin/poll.'}}%</div>{{/if}}
          {{#if b}}<div {{#if (response ref 'plugin/poll.b')}} class="voted" {{/if}} style="width: {{percent ref 'b' 'plugin/poll.'}}%">B: {{b}} {{percent ref 'b' 'plugin/poll.'}}%</div>{{/if}}
          {{#if c}}<div {{#if (response ref 'plugin/poll.c')}} class="voted" {{/if}} style="width: {{percent ref 'c' 'plugin/poll.'}}%">C: {{c}} {{percent ref 'c' 'plugin/poll.'}}%</div>{{/if}}
          {{#if d}}<div {{#if (response ref 'plugin/poll.d')}} class="voted" {{/if}} style="width: {{percent ref 'd' 'plugin/poll.'}}%">D: {{d}} {{percent ref 'd' 'plugin/poll.'}}%</div>{{/if}}
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
  name: $localize`🗳️🎫️ Poll Option A`,
  config: {
    mod: $localize`🗳️ Poll`,
    type: 'plugin',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const pollOptionBPlugin: Plugin = {
  tag: 'plugin/poll.b',
  name: $localize`🗳️🎫️ Poll Option B`,
  config: {
    mod: $localize`🗳️ Poll`,
    type: 'plugin',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const pollOptionCPlugin: Plugin = {
  tag: 'plugin/poll.c',
  name: $localize`🗳️🎫️ Poll Option C`,
  config: {
    mod: $localize`🗳️ Poll`,
    type: 'plugin',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const pollOptionDPlugin: Plugin = {
  tag: 'plugin/poll.d',
  name: $localize`🗳️🎫️ Poll Option D`,
  config: {
    mod: $localize`🗳️ Poll`,
    type: 'plugin',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const pollTemplate: Template = {
  tag: 'plugin/poll',
  name: $localize`🗳️ Poll`,
  config: {
    mod: $localize`🗳️ Poll`,
    type: 'plugin',
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    view: $localize`🗳️`,
    // language=CSS
    css: `
      app-ref-list.plugin-poll {
        .list-container {
          grid-auto-flow: row dense;
          padding: 4px;
          gap: 8px;
          grid-template-columns:  1fr;
          @media (min-width: 1000px) {
            grid-template-columns:  1fr 1fr;
          }
          @media (min-width: 1500px) {
            grid-template-columns: 1fr 1fr 1fr;
          }
          @media (min-width: 2000px) {
            grid-template-columns: 1fr 1fr 1fr 1fr;
          }
          .list-number {
            display: none;
          }
          .ref {
            break-inside: avoid;
            .toggle {
              display: none;
            }
            @media (max-width: 740px) {
              .actions, .info {
                height: 28px;
              }
            }
          }
        }
      }
    `,
  },
  defaults: {
    defaultExpanded: true,
    expandInline: false,
    defaultSort: 'modified,DESC',
    defaultCols: 0, // Leave to CSS screen size detection, but show cols dropdown
  }
};
