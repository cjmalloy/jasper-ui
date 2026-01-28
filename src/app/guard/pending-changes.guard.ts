import { CanDeactivateFn } from '@angular/router';

export interface HasChanges {
  saveChanges: () => Promise<boolean> | boolean;
}

export const pendingChangesGuard: CanDeactivateFn<HasChanges> = async (component, currentRoute, currentState, nextState) => {
  if (!component?.saveChanges || await component.saveChanges()) return true;
  return confirm($localize`Discard draft?`);
};
