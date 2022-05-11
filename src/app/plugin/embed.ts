import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { getHost, twitterHosts, youtubeHosts } from '../util/hosts';

export const embedPlugin: Plugin = {
  tag: 'plugin/embed',
  name: 'Embed Plugin',
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  },
  defaults: {},
  schema: {
    optionalProperties: {
      url: { type: 'string' },
      height: { type: 'int32', nullable: true },
      width: { type: 'int32', nullable: true },
      params: {
        elements: {
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
          },
        },
      },
    },
  },
};

export function isEmbed(url: string) {
  const host = getHost(url);
  if (!host) return false;
  return youtubeHosts.includes(host) || twitterHosts.includes(host);
}
