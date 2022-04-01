import * as moment from "moment";

export interface User {
  tag: string;
  origin: string;
  name?: string;
  readAccess?: string[];
  writeAccess?: string[];
  modified?: moment.Moment;
  pubKey?: string;
}

export function mapUser(obj: any): User {
  obj.modified = moment(obj.modified);
  return obj;
}

