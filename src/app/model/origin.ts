import * as moment from "moment";

export interface Origin {
  tag: string;
  url: string;
  name: string;
  proxy?: string;
  modified?: moment.Moment;
  lastScrape?: moment.Moment;
}

export function mapOrigin(obj: any): Origin {
  obj.modified = moment(obj.modified);
  obj.lastScrape = moment(obj.lastScrape);
  return obj;
}

