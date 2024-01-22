import { $localize } from '@angular/localize/init';
import * as moment from 'moment';
import { Template } from '../model/template';

export const rootTemplate: Template = {
  tag: '',
  name: $localize`⚓️ Root Template`,
  config: {
    default: true,
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
    description: $localize`Add common features Ext tag pages: Adding pinned Refs, sidebar markdown,
    a custom theme and a set of non-global custom themes to choose from in addition to global themes.`,
    aiInstructions: ` # Root Template
    The root template uses the empty string as a tag. Since templates are matched to Exts by prefix matching,
    the root template matches every tag. Here are the models in use:
    \`\`\`typescript
    ` + require('!!raw-loader!../model/tag.ts').default + `
    ` + require('!!raw-loader!../model/ref.ts').default + `
    ` + require('!!raw-loader!../model/ext.ts').default + `
    ` + require('!!raw-loader!../model/user.ts').default + `
    ` + require('!!raw-loader!../model/plugin.ts').default + `
    ` + require('!!raw-loader!../model/template.ts').default + `
    \`\`\`
    The root template sets up basic functionality such as deleted icons and filters, and basic Ext config:
    \`\`\`typescript
    export interface RootConfig {
      pinned?: string[];
      sidebar?: string;
      modmail?: boolean;
      dms?: string;
      queryFilters?: { query: string, label?: string}[];
      responseFilters?: { response: \`plugin/\${string}\` | \`!plugin/\${string}\`, label?: string }[];
      themes?: Record<string, string>;
      theme?: string;
      defaultSort?: string;
      submitText?: boolean;
      addTags?: string[];
      defaultThumbnail?: boolean;
      defaultExpanded?: boolean;
      hideEdit?: boolean;
      disableResize?: boolean;
      defaultCols?: number;
    }
    \`\`\`
    `,
    icons: [{ tag: 'plugin/delete', label: $localize`🗑️`, global: true }],
    form: [{
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
      key: 'submitText',
      type: 'select',
      defaultValue: false,
      props: {
        label: $localize`Submit:`,
        options: [
          { value: true, label: $localize`Text Posts` },
          { value: false, label: $localize`Link Posts` },
        ],
      }
    }, {
      key: 'addTags',
      type: 'tags',
      defaultValue: ['public'],
      props: {
        label: $localize`Add Tags:`
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
    }],
    advancedForm: [{
      key: 'dms',
      type: 'tag',
      props: {
        label: $localize`DMs:`
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
      key: 'defaultThumbnail',
      type: 'url',
      props: {
        label: $localize`Default Thumbnail:`
      }
    }, {
      key: 'defaultCols',
      type: 'select',
      props: {
        label: $localize`Columns:`,
        options: [
          { label: $localize`Default` },
          { value: 1, label: $localize`1 Column` },
          { value: 2, label: $localize`2 Columns` },
          { value: 3, label: $localize`3 Columns` },
          { value: 4, label: $localize`4 Columns` },
          { value: 5, label: $localize`5 Columns` },
          { value: 6, label: $localize`6 Columns` },
        ],
      },
    }],
  },
  defaults: <RootConfig> {
    defaultSort: 'published',
    addTags: ['public'],
  },
  schema: {
    optionalProperties: {
      pinned: { elements: { type: 'string' } },
      sidebar: { type: 'string' },
      modmail: { type: 'boolean' },
      dms: { type: 'string' },
      queryFilters: { elements: {
        properties: {
          query: { type: 'string' },
        },
        optionalProperties: {
          label: { type: 'string' },
        }
      }},
      responseFilters: { elements: {
        properties: {
          response: { type: 'string' },
        },
        optionalProperties: {
          label: { type: 'string' },
        }
      }},
      themes: { values: { type: 'string' } },
      theme: { type: 'string' },
      defaultSort: { type: 'string' },
      submitText: { type: 'boolean'},
      addTags: { elements: { type: 'string' } },
      defaultThumbnail: { type: 'string' },
      defaultExpanded: { type: 'boolean'},
      hideEdit: { type: 'boolean'},
      disableResize: { type: 'boolean'},
      defaultCols: { type: 'int8'},
    },
  },
};

export interface RootConfig {
  pinned?: string[];
  sidebar?: string;
  modmail?: boolean;
  dms?: string;
  queryFilters?: { query: string, label?: string}[];
  responseFilters?: { response: `plugin/${string}` | `!plugin/${string}`, label?: string }[];
  themes?: Record<string, string>;
  theme?: string;
  defaultSort?: string;
  submitText?: boolean;
  addTags?: string[];
  defaultThumbnail?: boolean;
  defaultExpanded?: boolean;
  hideEdit?: boolean;
  disableResize?: boolean;
  defaultCols?: number;
}

