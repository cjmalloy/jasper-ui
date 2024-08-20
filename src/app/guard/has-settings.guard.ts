import { inject } from '@angular/core';
import { CanActivateFn, createUrlTreeFromSnapshot, RedirectCommand } from '@angular/router';
import { isString } from 'lodash-es';
import { Store } from '../store/store';

export const hasSettingsGuard = (redirect: (string | (() => string))[]) => {
  const fn: CanActivateFn = ((route, state) => {
    const store = inject(Store);
    if (store.settings.plugins.length) return true;
    return new RedirectCommand(createUrlTreeFromSnapshot(route, redirect.map(r => isString(r) ? r : r())));
  });
  return fn;
};
