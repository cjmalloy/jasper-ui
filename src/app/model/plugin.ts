import * as moment from "moment";
import { Schema } from "jtd";

export interface Plugin {
  tag: string;
  origin?: string;
  name?: string;
  config?: any;
  defaults?: any;
  schema?: Schema;
  modified?: moment.Moment;
}

export function mapPlugin(obj: any): Plugin {
  obj.modified = moment(obj.modified);
  return obj;
}
