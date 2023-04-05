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

export type Role = 'ROLE_SYSADMIN' | 'ROLE_ADMIN' | 'ROLE_MOD' | 'ROLE_EDITOR' | 'ROLE_USER' | 'ROLE_VIEWER' | 'ROLE_ANONYMOUS';

export interface Roles {
  tag: string;
  sysadmin: boolean;
  admin: boolean;
  mod: boolean;
  editor: boolean;
  user: boolean;
  viewer: boolean;
}

export function mapUser(obj: any): User {
  obj.type = 'user';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified = moment(obj.modified);
  obj.pubKey = obj.pubKey && atob(obj.pubKey);
  return obj;
}

export function writeUser(user: User): User {
  const result = { ...user } as any;
  result.modified = result.modifiedString as any;
  result.pubKey = user.pubKey && btoa(user.pubKey);
  delete result.type;
  delete result.modifiedString;
  delete result.qualifiedTag;
  return result;
}

