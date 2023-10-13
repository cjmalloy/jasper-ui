import { $localize } from '@angular/localize/init';
import * as moment from 'moment';
import { Template } from '../model/template';

export const lockedIcon: Template = {
  tag: 'locked',
  name: $localize`🔒️ Locked`,
  config: {
    mod: $localize`🔒️ Locked Icon`,
    type: 'icon',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Show locked icon on locked Refs and add filters for
      locked and unlocked Refs`,
    icons: [
      { label: $localize`🔒️`, title: $localize`Locked`, order: -2 },
      { thumbnail: $localize`🔒️`, order: -1 },
    ],
    filters: [
      { query: 'locked', label: $localize`🔒️ locked`, group: $localize`Filters 🕵️️` },
      { query: '!locked', label: $localize`🔓️ unlocked`, group: $localize`Filters 🕵️️` },
    ],
  },
};

export const privateIcon: Template = {
  tag: 'public',
  name: $localize`🌐️ Public`,
  config: {
    mod: $localize`👁️ Private Icon`,
    type: 'icon',
    default: true,
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Show private icon on non-public Refs and add filters for
      private and public Refs`,
    icons: [
      { label: $localize`👁️`, tag: '!public', title: $localize`Private`, order: -2, global: true },
    ],
    filters: [
      { query: 'public', label: $localize`🌐️ public`, group: $localize`Filters 🕵️️` },
      { query: '!public', label: $localize`👁️ private`, group: $localize`Filters 🕵️️` },
    ],
  },
};

