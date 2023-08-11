import * as moment from 'moment';
import { Plugin } from '../../model/plugin';

export const graphPlugin: Plugin = {
  tag: 'plugin/graph',
  name: $localize`🎇️ Graph`,
  config: {
    type: 'viewer',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Activates built-in graph support and allows users to create graphs.`,
  },
  // TODO: Schema with graph overrides
};