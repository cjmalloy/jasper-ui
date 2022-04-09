import * as moment from 'moment';
import { HasTags } from './tag';

export interface Feed extends HasTags {
  url: string;
  name: string;
  lastScrape?: moment.Moment;
}

export function mapFeed(obj: any): Feed {
  obj.modified = moment(obj.modified);
  obj.lastScrape = moment(obj.lastScrape);
  return obj;
}
