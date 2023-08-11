import * as moment from 'moment';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';

export const originPlugin: Plugin = {
  tag: '+plugin/origin',
  name: $localize`🏛️ Remote Origin`,
  config: {
    type: 'core',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submit: $localize`🏛️ origin`,
    settings: $localize`origin`,
    icons: [{ label: $localize`🏛️` }],
    description: $localize`Replicate a remote Jasper instance. The remote
     origin will be scraped on an interval you specify.
     If the remote is also set up to replicate from this instance, you may
     communicate with remote users.
     You may configure if metadata is generated or plugins are validated. `,
    form: [{
      key: 'local',
      type: 'origin',
      props: {
        label: $localize`Local:`
      }
    }, {
      key: 'remote',
      type: 'origin',
      props: {
        label: $localize`Remote:`
      }
    }, {
      key: 'proxy',
      type: 'url',
      props: {
        label: $localize`Proxy:`
      }
    }],
  },
  schema: {
    optionalProperties: {
      local: { type: 'string' },
      remote: { type: 'string' },
      proxy: { type: 'string' },
    },
  },
};

export const originPullPlugin: Plugin = {
  tag: '+plugin/origin/pull',
  name: $localize`🏛️📥️ Remote Origin Pull`,
  config: {
    type: 'core',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submitChild: $localize`📥️ pull`,
    icons: [{ label: $localize`📥️` }],
    description: $localize`Replicate a remote Jasper instance. The remote
      origin will be scraped on an interval you specify.
      If the remote is also set up to replicate from this instance, you may
      communicate with remote users.
      You may configure if metadata is generated or plugins are validated. `,
    actions: [{ event: 'pull', label: $localize`pull` }],
    // language=Handlebars
    infoUi: `
      {{#if lastPull}}
        last pulled {{fromNow lastPull}}
      {{else}}
        not pulled yet
      {{/if}}
    `,
    advancedForm: [{
      key: 'query',
      type: 'query'
    }, {
      key: 'pullInterval',
      type: 'duration',
      defaultValue: 'PT15M',
      props: {
        label: $localize`Pull Interval:`,
      }
    }, {
      key: 'removeTags',
      type: 'tags',
      props: {
        label: $localize`Remove Tags:`,
      }
    }, {
      key: 'batchSize',
      type: 'integer',
      defaultValue: 250,
      props: {
        label: $localize`Batch Size:`,
      }
    }, {
      key: 'generateMetadata',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Generate Metadata:`,
      }
    }, {
      key: 'validationOrigin',
      type: 'origin',
      props: {
        label: $localize`Validation Origin:`,
      }
    }],
  },
  defaults: {
    pullInterval: 'PT15M',
    generateMetadata: true,
    validatePlugins: true,
    validateTemplates: true,
    validationOrigin: '',
  },
  schema: {
    properties: {
      pullInterval: { type: 'string' },
    },
    optionalProperties: {
      query: { type: 'string' },
      lastPull: { type: 'string' },
      batchSize: { type: 'int32' },
      generateMetadata: { type: 'boolean' },
      validatePlugins: { type: 'boolean' },
      validateTemplates: { type: 'boolean' },
      validationOrigin: { type: 'string' },
      originFromTag: { type: 'string' },
      addTags: { elements: { type: 'string' } },
      removeTags: { elements: { type: 'string' } },
    },
  },
};

export const originPushPlugin: Plugin = {
  tag: '+plugin/origin/push',
  name: $localize`🏛️📤️ Remote Origin Push`,
  config: {
    type: 'core',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submitChild: $localize`📤️ push`,
    icons: [{ label: $localize`📤️` }],
    description: $localize`Pushed modifications to a remote origin.
      On the scrape interval set, the server will check if the remote cursor is
      behind the local cursor. If writeOnly is set, this check is skipped and
      the lastModifiedWritten config is used instead.`,
    actions: [{ event: 'push', label: $localize`push` }],
    // language=Handlebars
    infoUi: `
      {{#if lastPush}}
        last pushed {{fromNow lastPush}}
      {{else}}
        not pushed yet
      {{/if}}
    `,
    advancedForm: [{
      key: 'query',
      type: 'query'
    }, {
      key: 'pushInterval',
      type: 'duration',
      defaultValue: 'PT15M',
      props: {
        label: $localize`Push Interval:`,
      }
    }, {
      key: 'batchSize',
      type: 'integer',
      defaultValue: 250,
      props: {
        label: $localize`Batch Size:`,
      }
    }, {
      key: 'checkRemoteCursor',
      type: 'boolean',
      props: {
        label: $localize`Check Remote Cursor:`,
      }
    }],
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
      lastPush: { type: 'string' },
      batchSize: { type: 'int32' },
      checkRemoteCursor: { type: 'boolean' },
      lastModifiedRefWritten: { elements: { type: 'string' } },
      lastModifiedExtWritten: { elements: { type: 'string' } },
      lastModifiedUserWritten: { elements: { type: 'string' } },
      lastModifiedPluginWritten: { elements: { type: 'string' } },
      lastModifiedTemplateWritten: { elements: { type: 'string' } },
    },
  },
};

export const originTunnelPlugin: Plugin = {
  tag: '+plugin/origin/tunnel',
  name: $localize`🏛️🕳️️️ Origin Tunnel`,
  config: {
    type: 'core',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submitChild: $localize`🕳️️️ tunnel`,
    icons: [{ label: $localize`🕳️️️` }],
    description: $localize`Create an SSH tunnel`,
    // language=Handlebars
    ui: `
      <div class="bubble form">
        <span class="nowrap">User Tag:</span>
        <div>{{ user }}</div>

        <span class="nowrap">SSH Host:</span>
        <div>{{ sshHost }}</div>
      </div>
    `,
    form: [{
      key: 'user',
      type: 'input',
      props: {
        label: $localize`User Tag:`,
        required: true,
      },
    }, {
      key: 'sshHost',
      type: 'input',
      props: {
        label: $localize`SSH Host:`,
      },
    }],
  },
  schema: {
    properties: {
      user: { type: 'string' },
    },
    optionalProperties: {
      sshHost: { type: 'string' },
    },
  },
};

export function isReplicating(remote: Ref, apis: Map<string, string>) {
  if (remote.plugins?.['+plugin/origin/push']) return false;
  const plugin = remote.plugins?.['+plugin/origin'];
  return apis.get(plugin?.remote || '') === remote.url;
}

export function isPushing(remote: Ref, origin = '') {
  if (!remote.plugins?.['+plugin/origin/push']) return false;
  const plugin = remote.plugins?.['+plugin/origin'];
  return (plugin?.local || '') === origin;
}