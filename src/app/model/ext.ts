import * as moment from 'moment';
import { Tag } from './tag';

export interface Ext extends Tag {
  type?: 'ext';
  config?: any;
}

export function mapTag(obj: any): Ext {
  obj.type = 'ext';
  obj.modified = moment(obj.modified);
  return obj;
}

export function writeExt(ext: Partial<Ext>): Partial<Ext> {
  const result = { ...ext };
  delete result.type;
  return result;
}
