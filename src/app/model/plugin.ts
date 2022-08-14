import { Schema } from 'jtd';
import * as moment from 'moment';
import { Tag } from './tag';

export interface Plugin extends Tag {
  type?: 'plugin';
  config?: any;
  defaults?: any;
  schema?: Schema;
  generateMetadata?: boolean;
}

export function mapPlugin(obj: any): Plugin {
  obj.type = 'plugin';
  obj.modified = moment(obj.modified);
  return obj;
}

export function maybePlugin(obj: any): Plugin | undefined {
  if (!obj) return undefined;
  return mapPlugin(obj);
}

export function writePlugin(plugin: Plugin): Record<string, any> {
  const result = { ...plugin };
  delete result.type;
  return result;
}
