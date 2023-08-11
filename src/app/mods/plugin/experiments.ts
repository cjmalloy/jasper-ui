import * as moment from 'moment';
import { Plugin } from '../../model/plugin';

export const experimentsPlugin: Plugin = {
  tag: 'plugin/experiments',
  name: $localize`🧪️ Experiments`,
  config: {
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Show experimental plugins on setup page`,
  }
};