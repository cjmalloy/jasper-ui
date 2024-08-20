import { inject } from '@angular/core';
import { CanActivateFn, createUrlTreeFromSnapshot, RedirectCommand } from '@angular/router';
import { isString } from 'lodash-es';
import { Store } from '../store/store';

export const hasRoleGuard = (role: 'admin' | 'mod' | 'editor' | 'user' | 'viewer' | 'banned', redirect: (string | (() => string))[]) => {
  const fn: CanActivateFn = ((route, state) => {
    if (inject(Store).account[role]) return true;
    return new RedirectCommand(createUrlTreeFromSnapshot(route, redirect.map(r => isString(r) ? r : r())));
  });
  return fn;
};
