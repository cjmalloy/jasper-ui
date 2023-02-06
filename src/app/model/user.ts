import * as moment from 'moment';
import { Tag } from './tag';

export interface User extends Tag {
  type?: 'user';
  role?: Role;
  readAccess?: string[];
  writeAccess?: string[];
  tagReadAccess?: string[];
  tagWriteAccess?: string[];
  pubKey?: string;
}

export type Role = 'ROLE_ADMIN' | 'ROLE_MOD' | 'ROLE_EDITOR' | 'ROLE_USER' | 'ROLE_VIEWER';

export interface Roles {
  tag: string;
  admin: boolean;
  mod: boolean;
  editor: boolean;
  user: boolean;
}

export function mapUser(obj: any): User {
  obj.type = 'user';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = moment(obj.modified);
  return obj;
}

export function writeUser(user: Partial<User>): Partial<User> {
  const result = { ...user };
  result.modified = result.modifiedString as any;
  delete result.type;
  delete result.modifiedString;
  return result;
}

