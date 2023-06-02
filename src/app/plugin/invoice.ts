import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const invoicePlugin: Plugin = {
  tag: 'plugin/invoice',
  name: $localize`🧾️ Invoice`,
  config: {
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
      { response: '-plugin/invoice.paid', label: $localize`🧾️ unpaid`, group: $localize`Invoices` },
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
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Used to mark status in the plugin/invoice workflow.`,
  },
  generateMetadata: true,
  userUrl: true,
};
