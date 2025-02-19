import { DateTime } from 'luxon';
import { Plugin } from "../model/plugin";
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const backgammonPlugin: Plugin = {
  tag: 'plugin/backgammon',
  name: $localize`🎲️ Backgammon`,
  config: {
    mod: $localize`🎲️ Backgammon`,
    type: 'plugin',
    submitText: true,
    editingViewer: true,
    generated: 'Generated by jenkins-ui ' + DateTime.now().toISO(),
    description: $localize`Activates built-in Backgammon game`,
    icons: [{ label: $localize`🎲️`, order: 3 }],
    published: $localize`played`,
    filters: [
      { query: 'plugin/backgammon', label: $localize`🎲️ backgammon`, title: $localize`Backgammon games`, group: $localize`Games 🕹️` },
    ],
    actions: [
      { tag: 'plugin/chat', labelOff: $localize`chat`, title: $localize`Open chatroom` },
      { event: 'flip', label: $localize`flip`, title: $localize`Spin the board 180 degrees.` },
      { event: 'reload', label: $localize`reload`, title: $localize`Reload the game.`  },
    ],
    // language=CSS
    css: `
      body.dark-theme {
        .backgammon-board {
          border: 0.5px solid rgba(255, 255, 255, 0.2);
        }
      }

      body.light-theme {
        .backgammon-board {
          border: 0.5px solid transparent;
        }
      }
    `,
    form: [{
      key: 'redName',
      type: 'string',
      props: {
        label: $localize`Red Player Name`,
      }
    }, {
      key: 'blackName',
      type: 'string',
      props: {
        label: $localize`Black Player Name`,
      }
    }],
  },
  schema: {
    optionalProperties: {
      redName: { type: 'string' },
      blackName: { type: 'string' },
    }
  }
};

export const backgammonTemplate: Template = {
  tag: 'plugin/backgammon',
  name: $localize`🎲️ Backgammon`,
  config: {
    mod: $localize`🎲️ Backgammon`,
    type: 'plugin',
    generated: 'Generated by jenkins-ui ' + DateTime.now().toISO(),
    view: $localize`🎲️`,
    // language=CSS
    css: `
      app-ref-list.plugin_backgammon {
        .list-container {
          grid-auto-flow: row dense;
          padding: 4px;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr);
          @media (min-width: 1500px) {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
          @media (min-width: 2000px) {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
          }
          .list-number {
            display: none;
          }
          .ref {
            min-width: 0;
            break-inside: avoid;
            .backgammon-board {
              max-height: unset;
            }
            .toggle {
              display: none;
            }
            @media (max-width: 740px) {
              .actions, .info {
                height: 28px;
              }
            }
          }
          .embed {
            display: block !important;
          }
        }
      }
    `,
    advancedForm: [{
      key: 'defaultExpanded',
      type: 'boolean',
      defaultValue: true,
      props: {
        label: $localize`Default Expanded:`,
      },
    }],
  },
  defaults: {
    defaultExpanded: true,
    defaultSort: ['modified,DESC'],
    defaultCols: 0, // Leave to CSS screen size detection, but show cols dropdown
  }
};

export const backgammonMod: Mod = {
  plugin: [
    backgammonPlugin,
  ],
   template: [
    backgammonTemplate,
  ],
};
