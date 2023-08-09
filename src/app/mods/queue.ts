import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';

export const queueTemplate: Template = {
  tag: 'queue',
  name: $localize`🚧️ Work Queue`,
  config: {
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    submit: $localize`🚧️ queue/`,
    description: $localize`Activates built-in Work Queue mode for managing workflows and invoices.`,
    filters: [
      { query: 'queue', label: $localize`🚧️ queue`, group: $localize`Templates 🎨️` },
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
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
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
      { response: '!plugin/invoice.paid', label: $localize`🧾️ unpaid`, group: $localize`Invoices` },
      { response: 'plugin/invoice.paid', label: $localize`💸️ paid`, group: $localize`Invoices` },
      { response: 'plugin/invoice.rejected', label: $localize`👎️ rejected`, group: $localize`Invoices` },
      { response: 'plugin/invoice.disputed', label: $localize`⚠️ disputed`, group: $localize`Invoices` },
    ],
  },
};

export const invoiceRejectionPlugin: Plugin = {
  tag: 'plugin/invoice.rejected',
  name: $localize`🧾️👎️ Invoice Rejected`,
  config: {
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Used to mark status in the plugin/invoice workflow.`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const invoiceDisputedPlugin: Plugin = {
  tag: 'plugin/invoice.disputed',
  name: $localize`🧾️⚠️ Invoice Disputed`,
  config: {
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Used to mark status in the plugin/invoice workflow.`,
  },
  generateMetadata: true,
  userUrl: true,
};

export const invoicePaidPlugin: Plugin = {
  tag: 'plugin/invoice.paid',
  name: $localize`🧾️💸️ Invoice Paid`,
  config: {
    mod: $localize`🚧️ Work Queue`,
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Used to mark status in the plugin/invoice workflow.`,
  },
  generateMetadata: true,
  userUrl: true,
};