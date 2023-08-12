import * as moment from 'moment';
import { Plugin } from '../../model/plugin';

export const debugPlugin: Plugin = {
  tag: 'plugin/debug',
  name: $localize`🐞️ Debug`,
  config: {
    type: 'tool',
    experimental: true,
    add: true,
    submit: '🐞️ debug',
    internal: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Debugging plugin will every feature turned on.`,
    extensions: ['.debug'],
    hosts: ['debug.local'],
    schemes: ['debug:'],
    published: $localize`debugging since`,
    css: `
        .tabs h5:after {
          content: ' 🐞️';
        }
    `,
    themes: {
      [$localize`Debug King`]: `
        .tabs h5:after {
          content: ' 👑️' !important;
        }
      `,
    },
    icons: [
      { label: $localize`🐞️` },
      { label: $localize`🔴️`, response: 'plugin/breakpoint', global: true },
    ],
    actions: [
      { response: 'plugin/breakpoint', labelOff: $localize`break`, labelOn: $localize`clear`, global: true },
    ],
    filters: [
      { query: 'plugin/debug', label: $localize`🐞️ debug`, group: $localize`Plugins 🧰️` },
      { response: 'plugin/breakpoint', label: $localize`🔴️ breakpoint`, group: $localize`Plugins 🧰️` },
    ],
    form: [{
      key: 'show',
      type: 'boolean',
      props: {
        label: $localize`Show:`,
        title: 'Toggles whether to show or hide the expandable UI.'
      },
    }, {
      key: 'input',
      type: 'string',
      props: {
        label: $localize`String:`,
      },
    }, {
      key: 'number',
      type: 'number',
      props: {
        label: $localize`Number:`,
      },
    }, {
      key: 'color',
      type: 'color',
    }, {
      key: 'url',
      type: 'url',
    }, {
      key: 'urls',
      type: 'urls',
    }, {
      key: 'email',
      type: 'email',
    }, {
      key: 'tel',
      type: 'tel',
    }, {
      key: 'date',
      type: 'date',
    }, {
      key: 'time',
      type: 'time',
    }, {
      key: 'datetime',
      type: 'datetime',
      props: {
        label: $localize`Datetime:`,
      },
    }, {
      key: 'week',
      type: 'week',
    }, {
      key: 'month',
      type: 'month',
    }, {
      key: 'duration',
      type: 'duration',
    }, {
      key: 'image',
      type: 'image',
    }, {
      key: 'video',
      type: 'video',
    }, {
      key: 'audio',
      type: 'audio',
    }, {
      key: 'qr',
      type: 'qr',
      props: {
        label: $localize`QR:`,
      },
    }, {
      key: 'tag',
      type: 'tag',
    }, {
      key: 'tags',
      type: 'tags',
    }, {
      key: 'qtag',
      type: 'qtag',
    }, {
      key: 'qtags',
      type: 'qtags',
    }, {
      key: 'user',
      type: 'user',
    }, {
      key: 'users',
      type: 'users',
    }, {
      key: 'quser',
      type: 'quser',
    }, {
      key: 'qusers',
      type: 'qusers',
    }, {
      key: 'selector',
      type: 'selector',
    }, {
      key: 'selectors',
      type: 'selectors',
    }, {
      key: 'query',
      type: 'query',
    }, {
      key: 'queries',
      type: 'queries',
    }, {
      key: 'textarea',
      type: 'textarea',
      props: {
        label: $localize`Text Area:`,
      },
    }, {
      key: 'multicheckbox',
      type: 'multicheckbox',
      props: {
        label: $localize`Multi-Checkbox:`,
        options: [
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
          { value: 'c', label: 'Option C' },
          { value: 'd', label: 'Option D' },
        ],
      },
    }, {
      key: 'radio',
      type: 'radio',
      props: {
        label: $localize`Radio:`,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
          { value: 'green', label: 'Green' },
        ],
      },
    }, {
      key: 'select',
      type: 'select',
      props: {
        label: $localize`Select:`,
        options: [
          { value: '1', label: 'Option 1' },
          { value: '2', label: 'Option 2' },
          { value: '3', label: 'Option 3' },
          { value: '4', label: 'Option 4' },
        ],
      },
    }],
    advancedForm: [{
      key: 'advanced',
      type: 'string',
      props: {
        label: $localize`Advanced:`,
      },
    }],
    // language=Handlebars
    ui: `{{#if show}}
     Input: {{ input }} <br>
     Number: {{ number }} <br>
     Url: {{ url }} <br>
     Textarea: {{ textarea }} <br>
     Multi-Checkbox:
      A = {{ multicheckbox.a }}
      B = {{ multicheckbox.b }}
      C = {{ multicheckbox.c }}
      D = {{ multicheckbox.d }} <br>
     Radio: {{ radio }} <br>
     Select: {{ select }}
     Advanced: {{ advanced }}
     {{/if}}
    `,
  },
  defaults: {},
  schema: {
    optionalProperties: {
      show: { type: 'boolean' },
      input: { type: 'string' },
      number: { type: 'int32' },
      color: { type: 'string' },
      url: { type: 'string' },
      urls: { elements: { type: 'string' } },
      email: { type: 'string' },
      tel: { type: 'string' },
      date: { type: 'string' },
      time: { type: 'string' },
      datetime: { type: 'string' },
      week: { type: 'string' },
      month: { type: 'string' },
      duration: { type: 'string' },
      image: { type: 'string' },
      video: { type: 'string' },
      audio: { type: 'string' },
      qr: { type: 'string' },
      tag: { type: 'string' },
      tags: { elements: { type: 'string' } },
      qtag: { type: 'string' },
      qtags: { elements: { type: 'string' } },
      user: { type: 'string' },
      users: { elements: { type: 'string' } },
      quser: { type: 'string' },
      qusers: { elements: { type: 'string' } },
      selector: { type: 'string' },
      selectors: { elements: { type: 'string' } },
      query: { type: 'string' },
      queries: { elements: { type: 'string' } },
      textarea: { type: 'string' },
      multicheckbox: {
        optionalProperties: {
          a: { type: 'boolean' },
          b: { type: 'boolean' },
          c: { type: 'boolean' },
          d: { type: 'boolean' },
        }
      },
      radio: { type: 'string' },
      select: { type: 'string' },
      advanced: { type: 'string' },
    },
  }
};

export const breakpointPlugin: Plugin = {
  tag: 'plugin/breakpoint',
  name: $localize`🔴️ Breakpoint`,
  config: {
    type: 'tool',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
  },
  generateMetadata: true,
  userUrl: true,
};
