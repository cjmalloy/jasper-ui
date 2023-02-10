import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';

export const originPlugin: Plugin = {
  tag: '+plugin/origin',
  name: $localize`Remote Origin`,
  config: {
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submit: $localize`🏛️ origin`,
    settings: $localize`🏛️ origin`,
    icons: [{ label: $localize`🏛️` }],
    description: $localize`Replicate a remote Jasper instance. The remote
     origin will be scraped on an interval you specify.
     If the remote is also set up to replicate from this instance, you may
     communicate with remote users.
     You may configure if metadata is generated or plugins are validated. `,
  },
  schema: {
    optionalProperties: {
      origin: { type: 'string' },
      remote: { type: 'string' },
      proxy: { type: 'string' },
    },
  },
};
export const pullPlugin: Plugin = {
  tag: '+plugin/origin/pull',
  name: $localize`Remote Origin Pull Replication`,
  config: {
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`📥️` }],
    description: $localize`Replicate a remote Jasper instance. The remote
      origin will be scraped on an interval you specify.
      If the remote is also set up to replicate from this instance, you may
      communicate with remote users.
      You may configure if metadata is generated or plugins are validated. `,
  },
  defaults: {
    pullInterval: 'PT15M',
    generateMetadata: true,
    validatePlugins: true,
    validateTemplates: true,
    validationOrigin: "",
  },
  schema: {
    optionalProperties: {
      query: { type: 'string' },
      lastPull: { type: 'string' },
      generateMetadata: { type: 'boolean' },
      validatePlugins: { type: 'boolean' },
      validateTemplates: { type: 'boolean' },
      removeTags: { elements: { type: 'string' } },
      mapTags: { values: { type: 'string' } },
      addTags: { elements: { type: 'string' } },
      mapOrigins: { values: { type: 'string' } },
      batchSize: { type: 'int8' },
    },
    properties: {
      pullInterval: { type: 'string' },
      validationOrigin: { type: 'string' },
    },
  },
};

export const pushPlugin: Plugin = {
  tag: '+plugin/origin/push',
  name: $localize`Remote Origin Push`,
  config: {
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ label: $localize`📤️` }],
    description: $localize`Pushed modifications to a remote origin.
      On the scrape interval set, the server will check if the remote cursor is
      behind the local cursor. If writeOnly is set, this check is skipped and
      the lastModifiedWritten config is used instead.`,
  },
  defaults: {
    pushInterval: 'PT15M',
    writeOnly: true,
  },
  schema: {
    properties: {
      pushInterval: { type: 'string' },
    },
    optionalProperties: {
      query: { type: 'string' },
      writeOnly: { type: 'boolean' },
      lastModifiedWritten: { elements: { type: 'string' } },
      lastPush: { type: 'string' },
      batchSize: { type: 'int8' },
    },
  },
};

export function isReplicating(remote: Ref, url: string, origin = '') {
  const plugin = remote.plugins?.['+plugin/origin'];
  return remote.url === url && (plugin?.remote || '') === origin;
}
