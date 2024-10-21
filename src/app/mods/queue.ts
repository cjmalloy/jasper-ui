import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const queueTemplate: Template = {
  tag: 'queue',
  name: $localize`🚧️ Work Queue`,
  config: {
    type: 'lens',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    submit: $localize`🚧️ queue/`,
    view: $localize`🚧️`,
    description: $localize`Activates built-in Work Queue mode for managing workflows and invoices.`,
    filters: [
      { query: 'queue', label: $localize`🚧️ queue`, title: $localize`Work Queues`, group: $localize`Templates 🎨️` },
    ],
    // language=Handlebars
    ui: `
      {{#if bounty}}
        <div class="ext-text">
          <b i18n>Bounty:</b> {{ bounty }}
        </div>
      {{/if}}
      {{#if maxAge}}
        <div class="ext-text">
          <b>Max Age:</b> {{ maxAge }}
        </div>
      {{/if}}
      {{#if approvers}}
        <div class="ext-text">
          <b i18n>Approvers:</b>
          <br>
          {{#each approvers}}
            <a class="tag" href="/tag/{{this}}">{{this}}</a>
            <br>
          {{/each}}
        </div>
      {{/if}}
      {{#if (includes approvers account.tag)}}
        <a class="sidebar-link" href="/tag/{{prefix 'plugin/invoice' tag}}">invoices</a>
      {{/if}}
    `,
    form: [{
      key: 'bounty',
      type: 'string',
      props: {
        label: $localize`Bounty: `
      }
    }, {
      key: 'maxAge',
      type: 'string',
      props: {
        label: $localize`Max Age: `
      }
    }, {
      key: 'approvers',
      type: 'qusers',
      props: {
        label: $localize`Approvers: `,
        addText: $localize`+ Add another approver`,
      }
    }]
  },
  defaults: {
    approvers: [],
  },
  schema: {
    properties: {
      approvers: { elements: { type: 'string' } },
    },
    optionalProperties: {
      bounty: { type: 'string' },
      maxAge: { type: 'string' },
    },
  },
};

export const invoicePlugin: Plugin = {
  tag: 'plugin/invoice',
  name: $localize`🧾️ Invoice`,
  config: {
    type: 'lens',
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Represent locked Refs as invoices and handle workflow status flow using plugin responses.`,
    icons: [
      { label: $localize`🧾️` },
      { label: $localize`👍️`, response: 'plugin/invoice.paid' },
      { label: $localize`👎️`, response: 'plugin/invoice.rejected' },
      { label: $localize`⚠️`, response: 'plugin/invoice.disputed' },
    ],
    actions: [
      { response: 'plugin/invoice.disputed', labelOff: $localize`dispute`, labelOn: $localize`un-dispute`, visible: 'author' },
      { response: 'plugin/invoice.rejected', clear: ['plugin/invoice.paid'], labelOff: $localize`reject`, labelOn: $localize`un-reject`, visible: 'recipient' },
      { response: 'plugin/invoice.paid', clear: ['plugin/invoice.rejected'], labelOff: $localize`paid`, labelOn: $localize`unpaid`, visible: 'recipient' },
    ],
    filters: [
      { query: 'plugin/invoice', label: $localize`🧾️ invoice`, title: $localize`Invoice`, group: $localize`Plugins 🧰️` },
      { response: '!plugin/invoice.paid', label: $localize`🧾️ unpaid`, title: $localize`Unpaid Invoices`, group: $localize`Invoices` },
      { response: 'plugin/invoice.paid', label: $localize`💸️ paid`, title: $localize`Paid Invoices`, group: $localize`Invoices` },
      { response: 'plugin/invoice.rejected', label: $localize`👎️ rejected`, title: $localize`Rejected Invoices`, group: $localize`Invoices` },
      { response: 'plugin/invoice.disputed', label: $localize`⚠️ disputed`, title: $localize`Disputed Invoices`, group: $localize`Invoices` },
    ],
  },
};

export const invoiceRejectionPlugin: Plugin = {
  tag: 'plugin/invoice.rejected',
  name: $localize`🧾️👎️ Invoice Rejected`,
  config: {
    type: 'lens',
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Used to mark status in the plugin/invoice workflow.`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const invoiceDisputedPlugin: Plugin = {
  tag: 'plugin/invoice.disputed',
  name: $localize`🧾️⚠️ Invoice Disputed`,
  config: {
    type: 'lens',
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Used to mark status in the plugin/invoice workflow.`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const invoicePaidPlugin: Plugin = {
  tag: 'plugin/invoice.paid',
  name: $localize`🧾️💸️ Invoice Paid`,
  config: {
    type: 'lens',
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Used to mark status in the plugin/invoice workflow.`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const queueMod: Mod = {
  plugins: {
    invoicePlugin,
    invoiceRejectionPlugin,
    invoiceDisputedPlugin,
    invoicePaidPlugin,
  },
  templates: {
    queueTemplate,
  },
};
