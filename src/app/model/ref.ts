import * as moment from 'moment';
import { HasTags } from './tag';

export interface Ref extends HasTags {
  title?: string;
  comment?: string;
  sources?: string[];
  alternateUrls?: string[];
  plugins?: Record<string, any>;
  metadata?: Metadata;
  published: moment.Moment;
  created?: moment.Moment;
}

export interface Metadata {
  responses: string[];
  internalResponses: string[];
  plugins: Record<string, string[]>;
}

export function mapRef(obj: any): Ref {
  obj.published = moment(obj.published);
  obj.created = moment(obj.created);
  obj.modified = moment(obj.modified);
  return obj;
}

export function writeRef(ref: Ref): Record<string, any> {
  const result = { ...ref };
  delete result.metadata;
  delete result.created;
  return result;
}
