import * as moment from 'moment';
import { HasTags } from './tag';

export interface Feed extends HasTags {
  url: string;
  name: string;
  lastScrape?: moment.Moment;
  scrapeInterval: moment.Duration;
  scrapeDuration: boolean;
  removeDurationIndent: boolean;
}

export function mapFeed(obj: any): Feed {
  obj.modified = moment(obj.modified);
  obj.scrapeDuration = moment.duration(obj.scrapeDuration);
  if (obj.lastScrape) obj.lastScrape = moment(obj.lastScrape);
  return obj;
}
