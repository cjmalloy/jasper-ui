import { DateTime } from 'luxon';
import { Mod } from '../model/tag';
import { Template } from '../model/template';

export const thanksConfig: Template = {
  tag: 'thanks',
  name: $localize`🙂️ thanks`,
  config: {
    type: 'tool',
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Quickly reply thanks to a ref.`,
    icons: [{ thumbnail: $localize`🙂️` }],
    actions: [{
      global: true,
      label: $localize`thanks`,
      // language=Handlebars
      emit: `[{
        "url": "comment:{{ uuid }}",
        "origin": "{{ ref.origin }}",
        "comment": "Thanks!",
        "sources": ["{{ ref.url }}"],
        "tags": ["public", "internal", "plugin/comment", "{{ user }}"]
      }]`,
    }],
  },
};

export const thanksMod: Mod = {
  template: [
    thanksConfig,
  ]
};
