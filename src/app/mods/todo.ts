import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const todoPlugin: Plugin = {
  tag: 'plugin/todo',
  name: $localize`📑️ To Do List`,
  config: {
    mod: $localize`📑️ To Do List`,
    type: 'plugin',
    experimental: true,
    submitText: true,
    editingViewer: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Create a To Do list.`,
    aiInstructions: ` # plugin/todo
    The todo plugin formats the comment of a ref as an editable TODO list.
    A TODO list should be of the form:
    - [ ] go-micro: Pluggable RPC framework
    - [ ] negroni: Idiomatic HTTP middleware
    - [ ] gorilla/mux: Powerful URL router
    - [ ] grpc-go: gRPC library
    - [ ] gin-gonic/gin: HTTP web framework
    - [ ] go-kit/kit: Tool for microservices

    Where lines starting with - [ ] are unchecked items, and lines starting
    with - [X] are checked items.

    When the user asks you to create a TODO list, add the plugin/todo tag and
    format the list as such. Remember to not include extra text in the comment
    field, as this will also be interpreted as a TODO list item. If mixing
    TODOs and other content is required, instead create a separate TODO list
    and embed it in another Ref using the embed link, such as: ![](ai:my-todo-list)`,
    icons: [{ label: $localize`📑️`, order: 2 }],
    filters: [
      { query: 'plugin/todo', label: $localize`📑️ todo`, group: $localize`Plugins 🧰️` },
    ],
  },
};

export const todoTemplate: Template = {
  tag: 'plugin/todo',
  name: $localize`📑️ To Do List`,
  config: {
    mod: $localize`📑️ To Do List`,
    type: 'plugin',
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    view: $localize`📑️`,
    // language=CSS
    css: `
      app-ref-list.plugin_todo {
        .list-container {
          grid-auto-flow: row dense;
          padding: 4px;
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
            break-inside: avoid;
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
    expandInline: false,
    defaultSort: 'modified,DESC',
    defaultCols: 0, // Leave to CSS screen size detection, but show cols dropdown
  }
};

export const todoMod: Mod = {
  plugins: {
    todoPlugin,
  },
  templates: {
    todoTemplate,
  },
};
