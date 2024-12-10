import { DateTime } from 'luxon';
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const htmlToMarkdownConfig: Template = {
  tag: 'html.markdown',
  name: $localize`⬇️ Markdown Converter`,
  config: {
    type: 'editor',
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Add button to editor to convert HTML into Markdown.`,
    editorButtons: [
      { label: $localize`⬇️`, title: $localize`Convert HTML to Markdown`, event: 'html-to-markdown', global: true },
    ],
  },
};

export const htmlToMarkdownMod: Mod = {
  template: [
    htmlToMarkdownConfig,
  ]
};
