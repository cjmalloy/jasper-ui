import * as moment from "moment";

export interface Template {
  tag: string;
  config?: any;
  defaults?: any;
  schema?: Record<string, any>;
  modified?: moment.Moment;
}

export function mapTemplate(obj: any): Template {
  obj.modified = moment(obj.modified);
  return obj;
}

