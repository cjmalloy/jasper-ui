import { $localize } from '@angular/localize/init';
import * as moment from 'moment';
import { Mod } from '../model/tag';
import { Template } from '../model/template';
import { RootConfig } from './root';

export const kanbanTemplate: Template = {
  tag: 'kanban',
  name: $localize`📋️ Kanban`,
  config: {
    mod: $localize`📋️ Kanban`,
    type: 'lens',
    default: true,
    generated: 'Generated by jasper-ui ' + moment().toISOString(),
    submit: $localize`📋️ kanban/`,
    view: $localize`📋️`,
    description: $localize`Activates built-in Kanban mode for viewing Refs.`,
    aiInstructions: `# kanban
    The kanban Template is used to organize Refs on a kanban board. The kanban Ext
    will customize what tags are used for columns, swim lanes and, badges.
    You may have been given the Ext as context, in which case it is easier to determine correct tag names.
    A user may ask you to add something to a kanban board such as kanban/testing.
    This means you should add the kanban/testing tag to the Ref you are adding.
    A user may also specifies a column. For example: add "fix mac" to the testing kanban
    and assign it to chris. This means you should create a ticket with a blank title and
    then comment "Fix Mac" with tags kanban/testing and assigned/chris.

    Since templates are hierarchical, kanbans are also hierarchical. This means if
    you add a Ref to kanban/a/b, it may also show up on kanban/a. Whether it actually
    shows up or not depends on the kanban's columns, swim lanes and badges.`,
    icons: [{ thumbnail: $localize`📋️`, order: 1 }],
    filters: [
      { query: 'kanban', label: $localize`📋️ kanban`, group: $localize`Templates 🎨️` },
    ],
    form: [{
      key: 'columns',
      className: 'columns',
      type: 'tags',
      props: {
        label: $localize`Columns:`,
        addText: $localize`+ Add another column`,
      }
    }, {
      key: 'showColumnBacklog',
      id: 'showColumnBacklog',
      type: 'boolean',
      props: {
        label: $localize`Show Columns Backlog:`
      }
    }, {
      key: 'columnBacklogTitle',
      id: 'columnBacklogTitle',
      type: 'string',
      props: {
        label: $localize`Column Backlog Title:`
      },
      expressions: {
        hide: '!field.parent.model.showColumnBacklog'
      },
    }, {
      key: 'swimLanes',
      className: 'swim-lanes',
      type: 'tags',
      props: {
        label: $localize`Swim Lanes:`,
        addText: $localize`+ Add another swim lane`,
      }
    }, {
      key: 'showSwimLaneBacklog',
      id: 'showSwimLaneBacklog',
      type: 'boolean',
      props: {
        label: $localize`Show Swim Lane Backlog:`
      },
      expressions: {
        hide: '!model.swimLanes || !model.swimLanes[0]'
      },
    }, {
      key: 'swimLaneBacklogTitle',
      id: 'swimLaneBacklogTitle',
      type: 'string',
      props: {
        label: $localize`Swim Lane Backlog Title:`
      },
      expressions: {
        hide: '!model.swimLanes || !model.swimLanes[0] || !model.showSwimLaneBacklog'
      },
    }, {
      key: 'hideSwimLanes',
      id: 'hideSwimLanes',
      type: 'boolean',
      props: {
        label: $localize`Hide Swim Lanes by Default:`
      },
      expressions: {
        hide: '!model.swimLanes || !model.swimLanes[0]'
      },
    }, {
      key: 'badges',
      className: 'badges',
      type: 'tags',
      props: {
        label: $localize`Badges:`,
        addText: $localize`+ Add another badge tag`,
      }
    }]
  },
  defaults: <KanbanConfig> {
    defaultSort: 'modified,desc',
    submitText: true,
    badges: ['p1', 'p2', 'p3', 'p4', 'p5']
  },
  schema: {
    optionalProperties: {
      columns: { elements: { type: 'string' } },
      showColumnBacklog: { type: 'boolean'},
      columnBacklogTitle: { type: 'string'},
      swimLanes: { elements: { type: 'string' } },
      hideSwimLanes: { type: 'boolean'},
      showSwimLaneBacklog: { type: 'boolean'},
      swimLaneBacklogTitle: { type: 'string'},
      badges: { elements: { type: 'string' } },
    },
  },
};

export interface KanbanConfig extends RootConfig {
  columns?: string[];
  showColumnBacklog?: boolean;
  columnBacklogTitle?: string;
  swimLanes?: string[];
  hideSwimLanes?: boolean;
  showSwimLaneBacklog?: boolean;
  swimLaneBacklogTitle?: string;
  badges?: string[];
}


export const kanbanMod: Mod = {
  templates: {
    kanbanTemplate,
  },
};
