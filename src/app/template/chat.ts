import * as moment from 'moment';
import { Template } from '../model/template';

export const chatTemplate: Template = {
  tag: 'chat',
  name: $localize`Chat Ext`,
  config: {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  },
};
