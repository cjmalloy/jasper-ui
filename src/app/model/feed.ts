import * as moment from 'moment';

export interface Feed {
  url: string;
  name: string;
  tags?: string[];
  modified?: moment.Moment;
  lastScrape?: moment.Moment;
}

export function mapFeed(obj: any): Feed {
  obj.modified = moment(obj.modified);
  obj.lastScrape = moment(obj.lastScrape);
  return obj;
}
