import * as moment from 'moment';
import { HasOrigin } from './tag';

export interface Origin extends HasOrigin {
  origin: string;
  url: string;
  name: string;
  proxy?: string;
  lastScrape?: moment.Moment;
}

export function mapOrigin(obj: any): Origin {
  obj.modified = moment(obj.modified);
  obj.lastScrape = moment(obj.lastScrape);
  return obj;
}

