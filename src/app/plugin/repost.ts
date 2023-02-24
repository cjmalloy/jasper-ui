import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const repostPlugin: Plugin = {
  tag: 'plugin/repost',
  name: $localize`↪️ Repost`,
  config: {
    type: 'semantic',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Re-submit a URL which has already been submitted by another user.
      The first source of this Ref is the URL to be reposted.`
  },
};
