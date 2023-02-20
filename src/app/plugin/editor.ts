import * as moment from 'moment';
import { Plugin } from '../model/plugin';

export const htmlPlugin: Plugin = {
  tag: 'plugin/html',
  name: $localize`📐️ HTML Editor`,
  config: {
    type: 'editor',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    editor: $localize`📐️️ html`,
  },
};

export const latexPlugin: Plugin = {
  tag: 'plugin/latex',
  name: $localize`💲️ Markdown LaTeX`,
  config: {
    type: 'editor',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    editor: $localize`💲️ latex`,
  },
};
