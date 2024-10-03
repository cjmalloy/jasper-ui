import { DateTime } from 'luxon';
import { Tag } from './tag';

export interface User extends Tag {
  type?: 'user';
  role?: Role;
  readAccess?: string[];
  writeAccess?: string[];
  tagReadAccess?: string[];
  tagWriteAccess?: string[];
  pubKey?: string;
  authorizedKeys?: string;
}

export type Role = 'ROLE_ADMIN' | 'ROLE_MOD' | 'ROLE_EDITOR' | 'ROLE_USER' | 'ROLE_VIEWER' | 'ROLE_ANONYMOUS' | 'ROLE_BANNED';

export interface Roles {
  debug: boolean;
  tag: string;
  admin: boolean;
  mod: boolean;
  editor: boolean;
  user: boolean;
  viewer: boolean;
  banned: boolean;
}

export function mapUser(obj: any): User {
  obj.type = 'user';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified &&= DateTime.fromISO(obj.modified);
  obj.pubKey &&= atob(obj.pubKey);
  return obj;
}

export function writeUser(user: User): User {
  const result = { ...user } as any;
  result.modified = result.modifiedString as any;
  result.pubKey = user.pubKey && btoa(user.pubKey);
  delete result.type;
  delete result.upload;
  delete result.exists;
  delete result.modifiedString;
  delete result.qualifiedTag;
  return result;
}

