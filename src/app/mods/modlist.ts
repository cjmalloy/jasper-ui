import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';
import { Template } from '../model/template';
import { dmTemplate, inboxPlugin, outboxPlugin } from './mailbox';

export const modlistConfig: Template = {
  tag: '_moderated',
  name: $localize`🛡️ Modlist`,
  config: {
    type: 'config',
    mod: $localize`🛡️ Mod Tools`,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`This tag marks posts as approved by a moderator. Adds a modlist tab to the inbox.`,
    icons: [
      { label: $localize`🛡️`, title: $localize`Moderated`, order: -1 },
    ],
    actions: [
      { tag: '_moderated', labelOff: $localize`approve`, title: $localize`Mark this post as moderated.`, global: true, order: -1 },
    ],
    filters: [
      { query: '!_moderated', label: $localize`🛡️ Mod Tools`, group: $localize`Mod Tools` },
    ],
  },
};

export const nsfwConfig: Template = {
  tag: 'nsfw',
  name: $localize`🔞️ NSFW`,
  config: {
    type: 'config',
    mod: $localize`🛡️ Mod Tools`,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`This tag marks posts as NSFW.`,
    advancedActions: [
      { tag: 'nsfw', labelOff: $localize`nsfw`, labelOn: $localize`sfw`, title: $localize`Mark posts as NSFW.`, global: true },
    ],
    filters: [
      { query: 'nsfw', label: $localize`🔞️ nsfw`, group: $localize`Mod Tools` },
    ],
  },
};

export const reportPlugin: Plugin = {
  tag: 'plugin/report',
  name: $localize`🙅️ Report`,
  config: {
    type: 'config',
    mod: $localize`🛡️ Mod Tools`,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`This plugin reports Refs for moderation.`,
    icons: [
      { label: $localize`🙅️`, response: 'plugin/report', title: $localize`Reported`, global: true, order: -1 },
    ],
    actions: [
      { response: 'plugin/report', labelOn: $localize`unflag`, title: $localize`Discard report.`, global: true, order: -1 },
      { response: '+plugin/approve', labelOff: $localize`approve`, title: $localize`Silence report.`, global: true, order: -1 }
    ],
    advancedActions: [
      { response: 'plugin/report', labelOff: $localize`flag`, title: $localize`Report a problem with this post.`, confirm: $localize`Are you sure you want to report this post?`, global: true, order: 1 },
    ],
    filters: [
      { response: 'plugin/report', label: $localize`🙅️ reports`, group: $localize`Mod Tools` },
    ],
  },
  userUrl: true,
  generateMetadata: true,
};

export const approvePlugin: Plugin = {
  tag: '+plugin/approve',
  name: $localize`🙆️ Approve`,
  config: {
    type: 'config',
    mod: $localize`🛡️ Mod Tools`,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`This plugin silences reports on a Ref.`,
    icons: [
      { label: $localize`🚩️`, anyResponse: 'plugin/report', noResponse: '+plugin/approve', title: $localize`Flagged`, global: true, order: -1 },
    ],
    filters: [
      { response: '+plugin/approve', label: $localize`🙆️ approved`, group: $localize`Mod Tools` },
    ],
  },
  generateMetadata: true,
};

export const modlistMod: Mod = {
  plugins: {
    reportPlugin,
    approvePlugin,
  },
  templates: {
    modlistConfig,
    nsfwConfig,
  },
};
