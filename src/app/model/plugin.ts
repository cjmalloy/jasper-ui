import * as moment from "moment";

export interface Plugin {
  tag: string;
  config?: any;
  defaults?: any;
  schema?: Record<string, any>;
  modified?: moment.Moment;
}

export function mapPlugin(obj: any): Plugin {
  obj.modified = moment(obj.modified);
  return obj;
}
