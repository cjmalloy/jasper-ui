import * as moment from 'moment';

export interface HasTag {
  tag: string;
  origin: string;
  name: string;
  modified: moment.Moment;
}
