import * as moment from 'moment';
import { Tag } from './tag';

export interface Ext extends Tag {
  type?: 'ext';
  config?: any;
}

export function mapTag(obj: any): Ext {
  obj.type = 'ext';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = moment(obj.modified);
  return obj;
}

export function writeExt(ext: Partial<Ext>): Partial<Ext> {
  const result = { ...ext };
  result.modified = result.modifiedString as any;
  delete result.type;
  delete result.modifiedString;
  return result;
}
