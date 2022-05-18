import * as moment from 'moment';
import { IsTag } from './tag';

export interface User extends IsTag {
  type?: 'user';
  readAccess?: string[];
  writeAccess?: string[];
  tagReadAccess?: string[];
  tagWriteAccess?: string[];
  pubKey?: string;
}

export interface Roles {
  tag: string;
  admin: boolean;
  mod: boolean;
  editor: boolean;
}

export function mapUser(obj: any): User {
  obj.type = 'user';
  obj.modified = moment(obj.modified);
  return obj;
}

export function writeUser(user: User): Record<string, any> {
  const result = { ...user };
  delete result.type;
  return result;
}

