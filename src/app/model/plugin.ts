import { Schema } from 'jtd';
import * as moment from 'moment';

export interface Plugin {
  tag: string;
  origin?: string;
  name?: string;
  config?: any;
  defaults?: any;
  schema?: Schema;
  generateMetadata?: boolean;
  modified?: moment.Moment;
}

export function mapPlugin(obj: any): Plugin {
  obj.modified = moment(obj.modified);
  return obj;
}
