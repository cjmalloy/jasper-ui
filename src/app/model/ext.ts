import * as moment from 'moment';
import { Tag } from './tag';

export interface Ext extends Tag {
  type?: 'ext';
  tag: string;
  origin?: string;
  name?: string;
  config?: any;
  modified?: moment.Moment;
}

export function mapTag(obj: any): Ext {
  obj.type = 'ext';
  obj.modified = moment(obj.modified);
  return obj;
}

export function writeExt(ext: Ext): Record<string, any> {
  const result = { ...ext };
  delete result.type;
  return result;
}
