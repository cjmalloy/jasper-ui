import * as moment from "moment";

export interface User {
  tag: string;
  origin: string;
  name?: string;
  watches?: string[];
  subscriptions?: string[];
  readAccess?: string[];
  writeAccess?: string[];
  lastNotified?: moment.Moment;
  modified?: moment.Moment;
  pubKey?: string;
}

export function mapUser(obj: any): User {
  obj.lastNotified = moment(obj.lastNotified);
  obj.modified = moment(obj.modified);
  return obj;
}

