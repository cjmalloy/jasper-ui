import { AbstractControl } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Subject } from 'rxjs';

/**
 * Shared map picker state for all location inputs in a plugin form.
 * The map is shown above the location input that opened it, and any
 * location in the host can be edited from it. Only one map is open at a time.
 */
export class LocationPicker {
  /**
   * The location input the map is shown above.
   */
  owner?: AbstractControl;
  /**
   * The location set by clicking the map.
   */
  active?: AbstractControl;
  readonly changes = new Subject<void>();

  constructor(
    readonly host: FormlyFieldConfig,
  ) { }

  get open() {
    return !!this.owner;
  }

  /**
   * Toggle the map for this control. If the map is already open for another
   * control, close it and open it here instead.
   */
  toggle(control: AbstractControl) {
    if (this.owner === control) {
      this.close();
      return;
    }
    if (openPicker && openPicker !== this) openPicker.close();
    openPicker = this;
    this.owner = this.active = control;
    this.changes.next();
  }

  close() {
    if (openPicker === this) openPicker = undefined;
    if (!this.owner && !this.active) return;
    this.owner = this.active = undefined;
    this.changes.next();
  }

  select(control?: AbstractControl) {
    if (!this.owner) return;
    control ||= this.owner;
    if (this.active === control) return;
    this.active = control;
    this.changes.next();
  }

  /**
   * A location input was removed. Removing the location the map is shown
   * above closes the map.
   */
  removed(control: AbstractControl) {
    if (this.owner === control) {
      this.close();
    } else if (this.active === control) {
      this.select(this.owner);
    }
  }
}

let openPicker: LocationPicker | undefined;

/**
 * Lists of locations kept closed as a linear ring (RFC 7946 3.1.6). The last
 * position is a hidden copy of the first.
 */
export const closedRings = new WeakSet<AbstractControl>();

/**
 * Lists of locations (lines, rings and multi points) by form control, so
 * points can be added from the map.
 */
export const locationLists = new WeakMap<AbstractControl, { add(index?: number, initialModel?: any): void }>();

const pickers = new WeakMap<FormlyFieldConfig, LocationPicker>();

/**
 * The outermost list containing this location. All locations in the host
 * are shown on the map.
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
