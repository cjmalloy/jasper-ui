import { inject } from '@angular/core';
import { CanActivateFn, createUrlTreeFromSnapshot, RedirectCommand } from '@angular/router';
import { AdminService } from '../service/admin.service';

export const installedModGuard = (tag: string, redirect: string) => {
  const fn: CanActivateFn = ((route, state) => {
    const admin = inject(AdminService);
    if (!!admin.getPlugin(tag) || !!admin.getTemplate(tag)) return true;
    return new RedirectCommand(createUrlTreeFromSnapshot(route, [redirect]));
  });
  return fn;
};
