import { inject } from '@angular/core';
import { CanActivateFn, createUrlTreeFromSnapshot, RedirectCommand } from '@angular/router';
import { isString } from 'lodash-es';
import { AdminService } from '../service/admin.service';

export const installedModGuard = (tag: string, redirect: (string | (() => string))[]) => {
  const fn: CanActivateFn = ((route, state) => {
    const admin = inject(AdminService);
    const installed = !!admin.getPlugin(tag) || !!admin.getTemplate(tag);
    if (installed) return true;
    return new RedirectCommand(createUrlTreeFromSnapshot(route, redirect.map(r => isString(r) ? r : r())));
  });
  return fn;
};
