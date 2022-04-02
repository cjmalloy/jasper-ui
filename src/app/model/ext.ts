import * as moment from "moment";

export interface Ext {
  tag: string;
  origin?: string;
  name?: string;
  config?: any;
  modified?: moment.Moment;
}

export function mapTag(obj: any): Ext {
  obj.modified = moment(obj.modified);
  return obj;
}
