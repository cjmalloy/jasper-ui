import { AbstractControl } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Subject } from 'rxjs';

/**
 * Shared map picker state for all location inputs in a plugin form.
 * Only one map is shown per host, and any location in the host can be
 * edited from it.
 */
export class LocationPicker {
  open = false;
  active?: AbstractControl;
  readonly changes = new Subject<void>();

  constructor(
    readonly host: FormlyFieldConfig,
  ) { }

  /**
   * Toggle the map for this control. If the map is already open for another
   * control, switch to this one instead.
   */
  toggle(control: AbstractControl) {
    if (this.open && this.active === control) {
      this.open = false;
      this.active = undefined;
    } else {
      this.open = true;
      this.active = control;
    }
    this.changes.next();
  }

  select(control?: AbstractControl) {
    if (this.active === control) return;
    this.active = control;
    this.changes.next();
  }
}

const pickers = new WeakMap<FormlyFieldConfig, LocationPicker>();

/**
 * The outermost list containing this location, so the map is never rendered
 * inside a draggable list item.
 */
export function locationMapHost(field: FormlyFieldConfig): FormlyFieldConfig {
  let host = field;
  for (let f = field.parent; f; f = f.parent) {
    if (f.type === 'list') host = f;
  }
  return host;
}

export function locationPicker(field: FormlyFieldConfig) {
  const host = locationMapHost(field);
  let picker = pickers.get(host);
  if (!picker) pickers.set(host, picker = new LocationPicker(host));
  return picker;
}

export function getLocationPicker(host: FormlyFieldConfig) {
  return pickers.get(host);
}
