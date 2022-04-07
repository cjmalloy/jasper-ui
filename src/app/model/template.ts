import { Schema } from 'jtd';
import * as moment from 'moment';

export interface Template {
  prefix: string;
  name?: string;
  config?: any;
  defaults?: any;
  schema?: Schema;
  modified?: moment.Moment;
}

export function mapTemplate(obj: any): Template {
  obj.modified = moment(obj.modified);
  return obj;
}

