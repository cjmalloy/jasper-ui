import { inject } from '@angular/core';
import { CanActivateFn, createUrlTreeFromSnapshot, RedirectCommand } from '@angular/router';
import { isString } from 'lodash-es';
import { Store } from '../store/store';


export const conditionGuard = (condition: () => any, redirect: (string | (() => string))[]) => {
  const fn: CanActivateFn = ((route, state) => {
    const store = inject(Store);
    if (condition()) return true;
    return new RedirectCommand(createUrlTreeFromSnapshot(route, redirect.map(r => isString(r) ? r : r())));
  });
  return fn;
};

export const redirectGuard = (redirect: () => string) => {
  const fn: CanActivateFn = ((route, state) => {
    return new RedirectCommand(createUrlTreeFromSnapshot(route, [redirect()]));
  });
  return fn;
};
