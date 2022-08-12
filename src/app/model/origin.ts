import * as moment from 'moment';
import { HasOrigin, TagPageArgs } from './tag';

export interface Origin extends HasOrigin {
  origin: string;
  url: string;
  name: string;
  proxy?: string;
  lastScrape?: moment.Moment;
}

export type OriginPageArgs = TagPageArgs & {
  sort?: OriginSort[],
};

export type OriginSort = '' |
  'modified' | 'modified,ASC' | 'modified,DESC' |
  'lastScrape' | 'lastScrape,ASC' | 'lastScrape,DESC' |
  'url' | 'url,ASC' | 'url,DESC' |
  'proxy' | 'proxy,ASC' | 'proxy,DESC' |
  'name' | 'name,ASC' | 'name,DESC' |
  'origin' | 'origin,ASC' | 'origin,DESC';


export function mapOrigin(obj: any): Origin {
  obj.modified = moment(obj.modified);
  if (obj.lastScrape) obj.lastScrape = moment(obj.lastScrape);
  return obj;
}

