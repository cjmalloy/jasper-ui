import * as moment from 'moment';

export interface HasModified {
  modified?: moment.Moment;
  modifiedString?: string;
}

export interface HasOrigin extends HasModified {
  origin?: string;
}

export interface Tag extends HasOrigin {
  type?: 'ext' | 'user' | 'plugin' | 'template';
  tag: string;
  name?: string;
}

export type TagQueryArgs = {
  query?: string,
  search?: string,
  modifiedAfter?: moment.Moment,
};

export type TagPageArgs = TagQueryArgs & {
  page?: number,
  size?: number,
  sort?: TagSort[],
};

export type TagSort = '' |
  'modified' | 'modified,ASC' | 'modified,DESC' |
  'tag' | 'tag,ASC' | 'tag,DESC' |
  'name' | 'name,ASC' | 'name,DESC' |
  'origin' | 'origin,ASC' | 'origin,DESC';
