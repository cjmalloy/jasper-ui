import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { getErrorMessage } from './errors';
import { LocationMapComponent } from './location-map.component';

@Component({
  selector: 'formly-field-location',
  host: { 'class': 'field location-field' },
  template: `
    <div class="location-input">
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
               [value]="lng"
               [disabled]="formControl.disabled"
               (input)="setLng($any($event.target).value)"
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
               [value]="lat"
               [disabled]="formControl.disabled"
               (input)="setLat($any($event.target).value)"
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
      @if (showMap) {
        @defer {
          <app-location-map [control]="formControl"></app-location-map>
        }
      }
    </div>
  `,
  styles: `
    .location-input {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
    LocationMapComponent,
  ],
})
export class FormlyFieldLocation extends FieldType<FieldTypeConfig> {

  showMap = false;

  private showedError = false;

  constructor(
    private config: FormlyConfig,
    private cd: ChangeDetectorRef,
  ) {
    super();
  }

  get lng(): number {
    return this.formControl.value?.[0] ?? 0;
  }

  get lat(): number {
    return this.formControl.value?.[1] ?? 0;
  }

  get hasLocation() {
    const v = this.formControl.value;
    return Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' && (v[0] !== 0 || v[1] !== 0);
  }

  setLng(value: string) {
    const lng = parseFloat(value);
    if (!isNaN(lng)) {
      this.setLocation([lng, this.lat]);
    }
  }

  setLat(value: string) {
    const lat = parseFloat(value);
    if (!isNaN(lat)) {
      this.setLocation([this.lng, lat]);
    }
  }

  setLocation(value: [number, number]) {
    this.formControl.setValue(value);
    this.formControl.markAsDirty();
    this.cd.markForCheck();
  }

  detectLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => this.setLocation([pos.coords.longitude, pos.coords.latitude]),
        err => console.error('Geolocation error:', err.message),
      );
    }
  }

  toggleMap() {
    this.showMap = !this.showMap;
    if (this.showMap && !this.hasLocation) this.detectLocation();
    this.cd.markForCheck();
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
