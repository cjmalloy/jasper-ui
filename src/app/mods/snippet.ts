import moment from 'moment';
import { Template } from '../model/template';

export const snippetConfig: Template = {
  tag: 'snippet',
  name: $localize`👨️‍💻️ Snippet`,
  config: {
    type: 'config',
    noUpdate: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    snippet: `
    <!-- Add your analytics trackers and other site scripts here -->
    `
  },
};
