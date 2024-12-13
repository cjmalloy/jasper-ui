import { CanDeactivateFn } from '@angular/router';

export interface HasChanges {
  saveChanges: () => boolean;
}

export const pendingChangesGuard: CanDeactivateFn<HasChanges> = (component, currentRoute, currentState, nextState) => {
  if (!component?.saveChanges || component.saveChanges()) return true;
  return confirm($localize`Discard draft?`);
};
