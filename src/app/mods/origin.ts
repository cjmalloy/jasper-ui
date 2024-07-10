import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { Mod } from '../model/tag';

export const originPlugin: Plugin = {
  tag: '+plugin/origin',
  name: $localize`🏛️ Remote Origin`,
  config: {
    mod: $localize`🏛️ Remote Origin`,
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submit: $localize`🏛️ origin`,
    settings: $localize`origin`,
    icons: [{ label: $localize`🏛️`, order: 3 }],
    description: $localize`Replicate a remote Jasper instance. The remote
     origin will be scraped on an interval you specify.
     If the remote is also set up to replicate from this instance, you may
     communicate with remote users.
     You may configure if metadata is generated or plugins are validated. `,
    form: [{
      key: 'local',
      id: 'local',
      type: 'origin',
      props: {
        label: $localize`Local:`
      }
    }, {
      key: 'remote',
      id: 'remote',
      type: 'origin',
      props: {
        label: $localize`Remote:`
      }
    }],
    advancedForm: [{
      key: 'proxy',
      id: 'proxy',
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
    mod: $localize`🏛️ Remote Origin`,
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submitChild: $localize`📥️ pull`,
    icons: [
      { label: $localize`📥️` },
      { tag: '-+plugin/cron',  label: $localize`🚫️`, order: -1 },
    ],
    description: $localize`Replicate a remote Jasper instance. The remote
      origin will be scraped on an interval you specify.
      If the remote is also set up to replicate from this instance, you may
      communicate with remote users.
      You may configure if metadata is generated or plugins are validated. `,
    actions: [
      { event: 'pull', label: $localize`pull` },
      { tag: '+plugin/cron', labelOn: $localize`disable`, labelOff: $localize`enable` },
    ],
    advancedForm: [{
      key: 'query',
      type: 'query'
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
      key: 'validatePlugins',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Validate Plugins:`,
      }
    }, {
      key: 'stripInvalidPlugins',
      type: 'boolean',
      props: {
        label: $localize`Strip Invalid Plugins:`,
      }
    }, {
      key: 'validateTemplates',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Validate Templates:`,
      }
    }, {
      key: 'stripInvalidTemplates',
      type: 'boolean',
      props: {
        label: $localize`Strip Invalid Templates:`,
      }
    }, {
      key: 'validationOrigin',
      type: 'origin',
      defaultValue: '',
      props: {
        label: $localize`Validation Origin:`,
      }
    }],
  },
  defaults: {
    generateMetadata: true,
    validatePlugins: true,
    validateTemplates: true,
    validationOrigin: '',
  },
  schema: {
    optionalProperties: {
      query: { type: 'string' },
      batchSize: { type: 'int32' },
      generateMetadata: { type: 'boolean' },
      validatePlugins: { type: 'boolean' },
      stripInvalidPlugins: { type: 'boolean' },
      validateTemplates: { type: 'boolean' },
      stripInvalidTemplates: { type: 'boolean' },
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
    mod: $localize`🏛️ Remote Origin`,
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submitChild: $localize`📤️ push`,
    icons: [{ label: $localize`📤️` }],
    description: $localize`Pushed modifications to a remote origin.
      On the scrape interval set, the server will check if the remote cursor is
      behind the local cursor. If writeOnly is set, this check is skipped and
      the lastModifiedWritten config is used instead.`,
    actions: [{ event: 'push', label: $localize`push` }],
    advancedForm: [{
      key: 'query',
      type: 'query'
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
  schema: {
    optionalProperties: {
      query: { type: 'string' },
      lastPush: { type: 'string' },
      batchSize: { type: 'int32' },
      checkRemoteCursor: { type: 'boolean' },
      lastModifiedRefWritten: { type: 'string' },
      lastModifiedExtWritten: { type: 'string' },
      lastModifiedUserWritten: { type: 'string' },
      lastModifiedPluginWritten: { type: 'string' },
      lastModifiedTemplateWritten: { type: 'string' },
    },
  },
};

export const originTunnelPlugin: Plugin = {
  tag: '+plugin/origin/tunnel',
  name: $localize`🏛️🕳️️️ Origin Tunnel`,
  config: {
    mod: $localize`🏛️ Remote Origin`,
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    submitChild: $localize`🕳️️️ tunnel`,
    icons: [{ label: $localize`🕳️️️` }],
    description: $localize`Create an SSH tunnel`,
    advancedForm: [{
      key: 'remoteUser',
      type: 'quser',
      props: {
        label: $localize`Remote User:`,
      },
    }, {
      key: 'sshHost',
      type: 'input',
      props: {
        label: $localize`SSH Host:`,
      },
    }, {
      key: 'sshPort',
      type: 'number',
      props: {
        label: $localize`SSH Port:`,
        min: 22,
      },
    }],
  },
  schema: {
    optionalProperties: {
      remoteUser: { type: 'string' },
      sshHost: { type: 'string' },
      sshPort: { type: 'uint32' },
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

export const remoteOriginMod: Mod = {
  plugins: {
    originPlugin,
    originPushPlugin,
    originPullPlugin,
    originTunnelPlugin,
  },
};
