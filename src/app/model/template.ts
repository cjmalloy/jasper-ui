import * as moment from "moment";
import { Schema } from "jtd";

export interface Template {
  tag: string;
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

