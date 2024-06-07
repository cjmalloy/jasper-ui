import moment from 'moment';
import { Plugin } from "../model/plugin";
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const chessPlugin: Plugin = {
  tag: 'plugin/chess',
  name: $localize`♟️ Chess`,
  config: {
    mod: $localize`♟️ Chess`,
    type: 'plugin',
    submitText: true,
    editingViewer: true,
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    icons: [{ label: $localize`♟️`, order: 3 }],
    description: $localize`Activates built-in Chess game`,
    aiInstructions: ` # plugin/chess
    When replying to a plugin/chess Ref, include the full previous game before your response in the comment field.
    Chess games are only stored in the comment field. They are Portable Game Notation (PGN) or the first line Forsyth-Edwards Notation (FEN) followed by optional newline delimited PGN-like list of Standard Algebraic Notation (SAN) moves.
    It is also customary to note the last move in the title suffix, such as ' | Rg3'.`,
    filters: [
      { query: 'plugin/chess', label: $localize`♟️ chess`, group: $localize`Plugins 🧰️` },
    ],
    actions: [
      { event: 'flip', label: $localize`flip` },
    ],
    // language=CSS
    css: `
      body.dark-theme {
        .chess-board {
          border: 0.5px solid rgba(255, 255, 255, 0.2);
        }
        .chess-piece {
          opacity: 0.8;
          &.b {
            filter: drop-shadow(0 0 1px white) drop-shadow(1px 1px 2px black) !important;
          }
        }
      }

      body.light-theme {
        .chess-board {
          border: 0.5px solid transparent;
        }
        .chess-board {
          .tile {
            &.light {
              background: repeating-linear-gradient(-80deg, rgba(200, 140, 50, 0.9), rgba(210, 140, 50, 0.9), rgba(180, 130, 45, 0.9) 50%) !important;
            }

            &.dark {
              background: repeating-linear-gradient(40deg, rgba(120, 70, 30, 0.9), rgba(130, 70, 30, 0.9), rgba(100, 60, 20, 0.9) 20%) !important;
            }
          }
        }

        .chess-piece {
          &.w {
            color: #DC9 !important;
          }

          &.b {
            opacity: 0.90;
            color: #123 !important;
            filter: drop-shadow(0 0 1px white) drop-shadow(1px 1px 2px black) !important;
          }
        }
      }
    `,
  },
};

export const chessTemplate: Template = {
  tag: 'plugin/chess',
  name: $localize`♟️ Chess`,
  config: {
    mod: $localize`♟️ Chess`,
    type: 'plugin',
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    view: $localize`♟️`,
    // language=CSS
    css: `
      app-ref-list.plugin_chess {
        .list-container {
          grid-auto-flow: row dense;
          padding: 4px;
          gap: 8px;
          grid-template-columns:  minmax(0, 1fr);
          @media (min-width: 1000px) {
            grid-template-columns:  minmax(0, 1fr) minmax(0, 1fr);
          }
          @media (min-width: 1500px) {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
          }
          @media (min-width: 2000px) {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
          }
          .list-number {
            display: none;
          }
          .ref {
            break-inside: avoid;
            .chess-board {
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
        }
      }
    `,
  },
  defaults: {
    defaultExpanded: true,
    defaultSort: 'modified,DESC',
    defaultCols: 0, // Leave to CSS screen size detection, but show cols dropdown
  }
};

export const chessMod: Mod = {
  plugins: {
    chessPlugin,
  },
  templates: {
    chessTemplate,
  },
};
