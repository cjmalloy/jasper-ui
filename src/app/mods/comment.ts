import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const commentPlugin: Plugin = {
  tag: 'plugin/comment',
  name: $localize`💬️ Comment`,
  config: {
    mod: $localize`💬️ Comment`,
    type: 'plugin',
    default: true,
    genId: true,
    internal: true,
    reply: ['internal', 'plugin/comment'],
    responseButton: $localize`💬️`,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Activates built-in comment support and allows users to create comments.`,
    aiInstructions: `# plugin/comment
    The plugin/comment tag indicates the Ref represents a comment on it's source.
    The first source (sources[0]) should be the immediate parent.
    The second source (sources[1]) should be the top of the comment thread.
    For top posts and first responses, including the top of the comment thread as both sources (sources[0] and sources[1])
    is recommended, as this will allow adding additional sources to be added without breaking threading.`,
    icons: [{ thumbnail: $localize`💬️`, order: 1 }],
    filters: [
      { query: 'plugin/comment', label: $localize`💬️ comments`, title: $localize`Comments`, group: $localize`Plugins 🧰️` },
    ],
  },
  generateMetadata: true,
};

export const commentMod: Mod = {
  plugin: [
    commentPlugin,
  ]
};
