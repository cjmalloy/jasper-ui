import { $localize } from '@angular/localize/init';
import { DateTime } from 'luxon';
import { Mod } from '../model/tag';
import { Template } from '../model/template';
import { RootConfig } from './root';

export const defaultSubs = ['+meta', 'science', 'politics', 'history', 'news', 'funny'];

export const userTemplate: Template = {
  tag: 'user',
  name: $localize`🧑️ User`,
  config: {
    mod: $localize`🧑️ User`,
    default: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Allows users to save useful public data in their Ext.`,
    aiInstructions: ` # user
    The user template allows users to interact with the system. User templates are only used as
    protected or private. By adding your user tag to a Ref you retain write access and (in the case
    of protected tags or private) allow others to see you as the author.

    When tagging another user in a Ref, the users inbox tag should be used to notify the user
    and give them read-access to the Ref.

    If you are responding to a thread or comment section where multiple users are talking, you may
    get sent messages where there is no response needed from you. For example, if a user is requested
    to reply to a thread, one convention is to simply reply tagging the user like so: '+user/chris'.
    If you receive such a message, simply respond 'ACK', so that we can silently hide your response.
    `,
    filters: [
      { query: '+user|_user', label: $localize`🧑️ user`, title: $localize`User Settings`, group: $localize`Templates 🎨️` },
    ],
    overrideForm: true,
    form: [{
      key: 'liveSearch',
      type: 'boolean',
      props: {
        label: $localize`Live Search:`,
        title: $localize`Search as you type.`,
      }
    }, {
      key: 'email',
      type: 'email',
    }, {
      key: 'subscriptions',
      type: 'queries',
      props: {
        label: $localize`Subscriptions:`,
        addText: $localize`+ Add another subscription`,
      },
      fieldArray: {
        props: {
          label: $localize`🏡`,
        }
      },
    }, {
      key: 'bookmarks',
      type: 'queries',
      props: {
        label: $localize`Bookmarks:`,
        addText: $localize`+ Add another bookmark`,
      }
    }, {
      key: 'alarms',
      type: 'queries',
      props: {
        label: $localize`Alarms:`,
        addText: $localize`+ Add another alarm`,
      },
      fieldArray: {
        props: {
          label: $localize`🔔`,
        }
      },
    }],
    advancedForm: [{
      key: 'queryStyle',
      type: 'enum',
      props: {
        label: $localize`Query Style:`,
        options: [
          { label: $localize`Default` },
          { value: 'code', label: $localize`Code` },
          { value: 'set', label: $localize`Set` },
          { value: 'logic', label: $localize`Logic` },
        ],
      },
    }, {
      key: 'editors',
      type: 'tags',
      props: {
        label: $localize`Editors:`,
        addText: $localize`+ Add another editor`,
      },
      fieldArray: {
        props: {
          label: $localize`📝`,
        }
      },
    }, {
      key: 'pinned',
      type: 'urls',
      props: {
        label: $localize`Pinned:`,
        addText: $localize`+ Add another pinned link`,
      },
      fieldArray: {
        props: {
          label: $localize`📌️`,
        }
      },
    }, {
      key: 'queryFilters',
      type: 'list',
      props: {
        label: $localize`Query Filters:`,
        addText: $localize`+ Add another query filter`,
      },
      fieldArray: {
        fieldGroup: [{
          key: 'label',
          type: 'string',
          props: {
            label: $localize`Label:`
          }
        }, {
          key: 'query',
          type: 'query',
          props: {
            required: true,
          }
        }]
      }
    }, {
      key: 'responseFilters',
      type: 'list',
      props: {
        label: $localize`Response Filters:`,
        addText: $localize`+ Add another response filter`,
      },
      fieldArray: {
        fieldGroup: [{
          key: 'label',
          type: 'string',
          props: {
            label: $localize`Label:`
          }
        }, {
          key: 'response',
          type: 'plugin',
          props: {
            required: true,
          }
        }]
      }
    }, {
      key: 'kanbanLoadSize',
      type: 'number',
      props: {
        label: $localize`Kanban Load Size:`,
      }
    }],
  },
  defaults: <UserConfig> {
    subscriptions: defaultSubs,
  },
  schema: {
    optionalProperties: {
      queryStyle: { type: 'string' },
      liveSearch: { type: 'boolean' },
      email: { type: 'string' },
      lastNotified: { type: 'string' },
      subscriptions: { elements: { type: 'string' } },
      bookmarks: { elements: { type: 'string' } },
      alarms: { elements: { type: 'string' } },
      editors: { elements: { type: 'string' } },
      userTheme: { type: "string" },
      consent: { values: { type: 'boolean' }},
      kanbanLoadSize: { type: "uint8" },
    }
  },
};

export interface UserConfig extends RootConfig {
  queryStyle?: string;
  liveSearch?: boolean;
  email?: string;
  lastNotified?: string;
  subscriptions?: string[];
  bookmarks?: string[];
  alarms?: string[];
  editors?: string[];
  userTheme?: string;
  consent?: { [key: string]: boolean };

  // TODO: move to ref `tag:/user/chris?url=tag:/kanban with plugin/settings/kanban
  kanbanLoadSize?: number;
}

export const userMod: Mod = {
  template: [
    userTemplate,
  ]
};
