import * as moment from 'moment';

export interface HasModified {
  modified?: moment.Moment;
}

export interface HasOrigin extends HasModified {
  origin?: string;
}

export interface HasTags extends HasOrigin {
  url: string;
  tags?: string[];
}

export interface IsTag extends HasOrigin {
  type?: 'ext' | 'user' | 'plugin' | 'template';
  tag: string;
  name?: string;
}
