import { Schema } from 'jtd';
import { isEqual } from 'lodash-es';
import { DateTime } from 'luxon';
import { Tag } from './tag';

export interface Ext extends Tag {
  type?: 'ext';
  config?: any;
}

export const extSchema: Schema = {
  optionalProperties: {
    tag: { type: 'string' },
    name: { type: 'string' },
    config: {},
  }
};

export function mapExt(obj: any): Ext {
  obj.type = 'ext';
  obj.origin ||= '';
  obj.modifiedString = obj.modified;
  obj.modified &&= DateTime.fromISO(obj.modified);
  return obj;
}

export function writeExt(ext: Ext): Ext {
  const result = { ...ext };
  result.modified = result.modifiedString as any;
  delete result.type;
  delete result.upload;
  delete result.exists;
  delete result.outdated;
  delete result.modifiedString;
  if (result.config) delete result.config._cache;
  return result;
}

export function equalsExt(a?: Ext, b?: Ext) {
  if (!a || !b) return false;
  return a.tag === b.tag &&
    a.name === b.name &&
    isEqual(a.config, b.config);
}
