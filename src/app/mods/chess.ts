import * as moment from 'moment';
import { Plugin } from "../model/plugin";
import { Template } from '../model/template';

export const chessPlugin: Plugin = {
  tag: 'plugin/chess',
  name: $localize`♘ Chess`,
  config: {
    mod: $localize`♘ Chess`,
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    icons: [{ label: $localize`♘`}],
    submit: $localize`♘ chess`,
    internal: true,
    description: $localize`Activates built-in Chess game`,
    filters: [
      { query: 'plugin/chess', label: $localize`♘ chess`, group: $localize`Plugins 🧰️` },
    ],
    // language=CSS
    css: `
      body.dark-theme {
        .chess-board {
          border: 0.5px solid rgba(255, 255, 255, 0.2);
        }
        .chess-piece {
          opacity: 0.8;
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
            color: #00184b !important;
          }
        }
      }
    `,
  },
};

export const chessTemplate: Template = {
  tag: 'plugin/chess',
  name: $localize`♘ Chess`,
  config: {
    mod: $localize`♘ Chess`,
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    view: $localize`♘`,
    // language=CSS
    css: `
      app-ref-list.plugin-chess {
        .list-container {
          grid-auto-flow: row dense;
          margin: 4px;
          gap: 8px;
          grid-template-columns:  1fr;
          @media (min-width: 1000px) {
            grid-template-columns:  1fr 1fr;
          }
          @media (min-width: 1500px) {
            grid-template-columns: 1fr 1fr 1fr;
          }
          @media (min-width: 2000px) {
            grid-template-columns: 1fr 1fr 1fr 1fr;
          }
          .list-number {
            display: none;
          }
          .ref {
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
    defaultCols: 0, // Leave to CSS screen size detection, but show cols dropdown
  }
};
