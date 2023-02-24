import * as moment from 'moment';
import { Template } from '../model/template';

export const chatTemplate: Template = {
  tag: 'chat',
  name: $localize`💬️ Chat`,
  config: {
    experimental: true,
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    submit: $localize`💬️ chat`,
    view: $localize`💬️`,
  },
};
