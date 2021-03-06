import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { bitchuteHosts, getHost, imgurHosts, twitterHosts, youtubeHosts } from '../util/hosts';
import { isImage } from './image';
import { isVideo } from './video';

export const thumbnailPlugin: Plugin = {
  tag: 'plugin/thumbnail',
  name: 'Thumbnail Plugin',
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  },
  defaults: {},
  schema: {
    optionalProperties: {
      url: { type: 'string' },
      height: { type: 'int32', nullable: true },
      width: { type: 'int32', nullable: true },
      time: { type: 'timestamp', nullable: true },
    },
  },
};

export function isKnownThumbnail(url: string) {
  const host = getHost(url);
  if (!host) return false;
  return isImage(url) ||
    isVideo(url) ||
    youtubeHosts.includes(host) ||
    bitchuteHosts.includes(host) ||
    imgurHosts.includes(host);
}
