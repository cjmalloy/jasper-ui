import * as moment from "moment";

export interface Tag {
  tag: string;
  origin: string;
  name: string;
  color: number;
  textColor: number;
  config: any;
  modified?: moment.Moment;
}

export function mapTag(obj: any): Tag {
  obj.modified = moment(obj.modified);
  return obj;
}
