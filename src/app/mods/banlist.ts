import moment from 'moment';
import { Template } from '../model/template';

export const banlistConfig: Template = {
  tag: 'banlist',
  name: $localize`🚫️ Banlist`,
  config: {
    type: 'config',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    bannedUrls: [
      '//bit.ly/',
      '//ow.ly/',
      '//tinyurl.com/',
      '//is.gd/',
      '//buff.ly/',
      '//adf.ly/',
      '//bit.do/',
      '//mcaf.ee/',
      '//su.pr/',
    ],
    expandShorteners: {
      'https://youtu.be/': 'https://www.youtube.com/watch?v=',
      'https://m.youtube.com/': 'https://www.youtube.com/',
      'https://youtube.com/': 'https://www.youtube.com/',
    },
    stripTrackers: [
      '//x.com/',
      '//twitter.com/',
      '//www.youtube.com/',
      '//www.amazon.',
    ],
  },
};

