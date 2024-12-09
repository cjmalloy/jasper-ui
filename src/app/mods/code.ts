import { $localize } from '@angular/localize/init';
import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const codePlugin: Plugin = {
  tag: 'plugin/code',
  name: $localize`🗒️ Code`,
  config: {
    type: 'editor',
    default: true,
    editingViewer: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Uses the monaco editor (like vscode).`,
    aiInstructions: `# plugin/code
    The plugin/code tag indicates the Ref comment is source code. The child tag (like plugin/code/json) indicates the type.`,
    icons: [{ label: $localize`🗒️`, order: 2 }],
    filters: [
      { query: 'plugin/code', label: $localize`🗒️ code`, title: $localize`Code`, group: $localize`Plugins 🧰️` },
    ],
  },
};

export const codeMod: Mod = {
  plugin: [
    codePlugin,
  ]
};