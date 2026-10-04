import { computed, Component, DestroyRef, inject, afterNextRender } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { getErrorMessage } from './errors';
import { controlValue } from '../util/form';
import { LocationMapComponent } from './location-map.component';
import { parseLocation } from '../util/geo';
import { LocationPicker, locationPicker } from './location-picker';

@Component({
  selector: 'formly-field-location',
  host: { 'class': 'field location-field' },
  template: `
    <div class="location-input">
      @if (showMap) {
        @defer {
          <app-location-map [picker]="picker" />
        }
      }
      <div class="form-array">
        <input type="number"
               class="grow"
               placeholder="Longitude"
               i18n-placeholder
               min="-180"
               max="180"
               step="any"
               aria-label="Longitude"
               i18n-aria-label
               [value]="lng()"
               [disabled]="formControl.disabled"
               (input)="setLng($any($event.target).value)"
               (paste)="paste($event)"
               (blur)="blur($any($event.target))"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
        <input type="number"
               class="grow"
               placeholder="Latitude"
               i18n-placeholder
               min="-90"
               max="90"
               step="any"
               [id]="field.id + '-lat'"
               [name]="(field.name || field.id) + '-lat'"
               aria-label="Latitude"
               i18n-aria-label
               [value]="lat()"
               [disabled]="formControl.disabled"
               (input)="setLat($any($event.target).value)"
               (paste)="paste($event)"
               (blur)="blur($any($event.target))"
               [class.is-invalid]="showError">
        <button type="button"
                class="location-detect"
                title="Use current location"
                i18n-title
                aria-label="Use current location"
                i18n-aria-label
                [disabled]="formControl.disabled"
                (click)="detectLocation()"
                i18n>📍️</button>
        <button type="button"
                class="location-map-toggle"
                title="Pick location on map"
                i18n-title
                aria-label="Pick location on map"
                i18n-aria-label
                [class.toggled]="showMap"
                [attr.aria-pressed]="showMap"
                [disabled]="formControl.disabled"
                (click)="toggleMap()"
                i18n>🗺️</button>
      </div>
    </div>
  `,
  styles: `
    .location-input {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-width: 0;
    }
    @media (max-width: 740px) {
      .location-input {
        container-type: inline-size;
      }
    }
    .location-input input {
      min-width: 0;
      width: 120px;
    }
    @container (max-width: 240px) {
      .location-input .form-array {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-rows: auto auto;
        grid-auto-flow: column;
        gap: 4px;
      }
      .location-input .form-array > * {
        margin-right: 0;
      }
      .location-input input {
        width: auto;
      }
    }
  `,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
    LocationMapComponent,
  ],
})
export class FormlyFieldLocation extends FieldType<FieldTypeConfig> {
  private config = inject(FormlyConfig);


  private showedError = false;
  private readonly coords = controlValue<number[]>(() => this.formControl);
  private readonly cleanup = inject(DestroyRef).onDestroy(() => this.picker.removed(this.formControl));

  readonly lng = computed<number>(() => {
    return this.coords()?.[0] ?? 0;
  });

  readonly lat = computed<number>(() => {
    return this.coords()?.[1] ?? 0;
  });

  private readonly init = afterNextRender(() => {
    if (this.picker.open && !this.hasLocation) {
      // New point added while the map is open: select it so it can be placed by clicking the map
      this.picker.select(this.formControl);
    }
  });

  get picker(): LocationPicker {
    return locationPicker(this.field);
  }

  get showMap() {
    return this.picker.owner() === this.formControl;
  }

  get hasLocation() {
    const v = this.formControl.value;
    return Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' && (v[0] !== 0 || v[1] !== 0);
  }

  setLng(value: string) {
    const lng = parseFloat(value);
    if (!isNaN(lng)) {
      this.setLocation([lng, this.lat()]);
    }
  }

  setLat(value: string) {
    const lat = parseFloat(value);
    if (!isNaN(lat)) {
      this.setLocation([this.lng(), lat]);
    }
  }

  /**
   * Pasting "lng, lat" fills in both inputs.
   */
  paste(event: ClipboardEvent) {
    const location = parseLocation(event.clipboardData?.getData('text') || '');
    if (!location) return;
    event.preventDefault();
    this.setLocation(location);
  }

  setLocation(value: [number, number]) {
    this.formControl.setValue(value);
    this.formControl.markAsDirty();
  }

  detectLocation(onlyIfUnset = false) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          if (onlyIfUnset && (!this.showMap || this.hasLocation)) return;
          this.setLocation([pos.coords.longitude, pos.coords.latitude]);
        },
        err => console.error('Geolocation error:', err.message),
      );
    }
  }

  toggleMap() {
    this.picker.toggle(this.formControl);
    if (this.showMap && !this.hasLocation) this.detectLocation(true);
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }

  blur(input: HTMLInputElement) {
    if (this.showError && !this.showedError) {
      this.showedError = true;
      this.validate(input);
    } else {
      this.showedError = false;
    }
  }
}
