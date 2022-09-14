import { Schema } from 'jtd';
import * as moment from 'moment';
import { Tag } from './tag';

export interface Template extends Tag {
  type?: 'template';
  config?: any;
  defaults?: any;
  schema?: Schema;
}

export function mapTemplate(obj: any): Template {
  obj.type = 'template';
  obj.modifiedString = obj.modified;
  obj.modified = moment(obj.modified);
  return obj;
}

export function maybeTemplate(obj: any): Template | undefined {
  if (!obj) return undefined;
  return mapTemplate(obj);
}

export function writeTemplate(template: Partial<Template>): Partial<Template> {
  const result = { ...template };
  result.modified = result.modifiedString as any;
  delete result.type;
  delete result.modifiedString;
  return result;
}

