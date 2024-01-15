import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { Store } from '../store/store';

export const clearLastSelected: CanMatchFn = () => {
  inject(Store).view.clearLastSelected();
  return true;
};
