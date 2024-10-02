import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';

export const repostPlugin: Plugin = {
  tag: 'plugin/repost',
  name: $localize`↪️ Repost`,
  config: {
    type: 'semantic',
    default: true,
    add: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Re-submit a URL which has already been submitted by another user.
      The first source of this Ref is the URL to be reposted.`,
    aiInstructions: ` # plugin/repost
    The repost plugin allows you to post a URL or text post again under a new URL, with a fresh
    reply section and comment area. This is particularly useful if you want to do something to
    an existing Ref that you do not have write access to, such as tagging a Ref, manipulating a Ref
    on a kanban board, sending a Ref in a DM, or posting a Ref to a tag with a new comments area
    for discussion.
    `,
    icons: [{ label: $localize`↪️` }],
    filters: [
      { query: 'plugin/repost', label: $localize`↪️ Repost`, title: $localize`Reposts`, group: $localize`Plugins 🧰️` },
    ],
  },
};
