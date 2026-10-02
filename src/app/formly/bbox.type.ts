import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

/**
 * GeoJSON bounding box: [west, south, east, north]
 * or [west, south, minZ, east, north, maxZ] (altitudes are preserved)
 */
@Component({
  selector: 'formly-field-bbox',
  host: { 'class': 'field bbox-field' },
  template: `
    <div class="form-array">
      @for (side of sides; track side.index) {
        <input type="number"
               class="grow bbox-{{ side.name }}"
               step="any"
               [min]="side.min"
               [max]="side.max"
               [placeholder]="side.label"
               [attr.aria-label]="side.label"
               [id]="side.index ? field.id + '-' + side.name : field.id"
               [value]="value(side.index)"
               [disabled]="formControl.disabled"
               (input)="set(side.index, $any($event.target).value)">
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class FormlyFieldBbox extends FieldType<FieldTypeConfig> {

  sides = [
    { index: 0, name: 'west', label: $localize`West`, min: -180, max: 180 },
    { index: 1, name: 'south', label: $localize`South`, min: -90, max: 90 },
    { index: 2, name: 'east', label: $localize`East`, min: -180, max: 180 },
    { index: 3, name: 'north', label: $localize`North`, min: -90, max: 90 },
  ];

  get is3d() {
    return this.formControl.value?.length === 6;
  }

  pos(index: number) {
    return this.is3d && index >= 2 ? index + 1 : index;
  }

  value(index: number) {
    return this.formControl.value?.[this.pos(index)] ?? '';
  }

  set(index: number, value: string) {
    const length = this.is3d ? 6 : 4;
    const bbox: (number | null)[] = Array.from({ length }, (_, i) => this.formControl.value?.[i] ?? null);
    const n = parseFloat(value);
    bbox[this.pos(index)] = isNaN(n) ? null : n;
    this.formControl.setValue(bbox.every(b => b === null) ? undefined : bbox.map(b => b ?? 0));
    this.formControl.markAsDirty();
  }
}
