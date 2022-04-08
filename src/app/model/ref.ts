import * as moment from 'moment';

export interface Ref {
  url: string;
  origin?: string;
  title?: string;
  comment?: string;
  tags?: string[];
  sources?: string[];
  alternateUrls?: string[];
  plugins?: Record<string, any>;
  metadata?: Metadata;
  published: moment.Moment;
  created?: moment.Moment;
  modified?: moment.Moment;
}

export interface Metadata {
  responses: string[];
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
