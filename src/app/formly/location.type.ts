import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-location',
  host: { 'class': 'field location-field' },
  template: `
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
              title="Use current location"
              i18n-title
              [disabled]="formControl.disabled"
              (click)="detectLocation()"
              i18n>📍️</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldLocation extends FieldType<FieldTypeConfig> {

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

  setLng(value: string) {
    const lng = parseFloat(value);
    if (!isNaN(lng)) {
      this.formControl.setValue([lng, this.lat]);
      this.formControl.markAsDirty();
    }
  }

  setLat(value: string) {
    const lat = parseFloat(value);
    if (!isNaN(lat)) {
      this.formControl.setValue([this.lng, lat]);
      this.formControl.markAsDirty();
    }
  }

  detectLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.formControl.setValue([pos.coords.longitude, pos.coords.latitude]);
          this.formControl.markAsDirty();
          this.cd.markForCheck();
        },
        err => console.error('Geolocation error:', err.message),
      );
    }
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
