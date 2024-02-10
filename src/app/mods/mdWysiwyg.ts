import * as moment from 'moment';
import { Template } from '../model/template';

export const mdWysiwygConfig: Template = {
  tag: 'md.wysiwyg',
  name: $localize`🌄️ Markdown WYSIWYG`,
  config: {
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Use WYSIWYG editor to edit markdown.`,
  },
};
