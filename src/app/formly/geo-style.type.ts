import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';
import { GEO_FILL_STYLES, GEO_STROKE_STYLES, GEO_STROKE_WIDTHS, GeoStyle } from '../util/geo-style';

const DEFAULTS: GeoStyle = {
  strokeWidth: 'medium',
  strokeStyle: 'solid',
  fillStyle: 'default',
};

/**
 * Style of a GeoJSON feature, with the stroke and fill each on their own
 * labeled form grid row. The value is the feature properties object: other
 * properties are kept, and defaults are removed.
 * Set props.fill to false to hide the fill style for geometries without an area.
 */
@Component({
  selector: 'formly-field-geo-style',
  host: { 'class': 'field geo-style-field' },
  template: `
    <label class="form-label geo-style-stroke-label" [attr.for]="field.id" i18n>Stroke: </label>
    <div class="form-array geo-style-stroke">
      <input type="color"
             class="geo-style-color"
             [id]="field.id"
             i18n-title title="Stroke Color"
             i18n-aria-label aria-label="Stroke Color"
             [class.cleared]="!style.color"
             [value]="style.color || ''"
             [disabled]="formControl.disabled"
             (input)="set('color', $any($event.target).value)">
      <div class="range-input geo-style-stroke-width-input">
        <div class="range-value geo-style-stroke-width-label" aria-hidden="true">{{ strokeWidths[strokeWidthIndex].label }}</div>
        <input type="range"
               class="geo-style-stroke-width"
               min="0" [max]="strokeWidths.length - 1" step="1"
               i18n-aria-label aria-label="Stroke Width"
               [title]="strokeWidthLabel"
               [attr.aria-valuetext]="strokeWidthLabel"
               [value]="strokeWidthIndex"
               [disabled]="formControl.disabled"
               (input)="set('strokeWidth', strokeWidths[+$any($event.target).value].value)">
      </div>
      <select class="geo-style-stroke-style"
              i18n-title title="Stroke Style"
              i18n-aria-label aria-label="Stroke Style"
              [disabled]="formControl.disabled"
              (input)="set('strokeStyle', $any($event.target).value)">
        @for (o of strokeStyles; track o.value) {
          <option [value]="o.value" [selected]="o.value === (style.strokeStyle || defaults.strokeStyle)">{{ o.label }}</option>
        }
      </select>
      <button type="button" class="geo-style-stroke-clear" (click)="clear('color', 'strokeWidth', 'strokeStyle')" i18n-title title="Clear Stroke" i18n>🆑️</button>
    </div>
    @if (fill) {
      <label class="form-label geo-style-fill-label" [attr.for]="field.id + '-fill'" i18n>Fill: </label>
      <div class="form-array geo-style-fill">
        <input type="color"
               class="geo-style-fill-color"
               [id]="field.id + '-fill'"
               i18n-title title="Fill Color (defaults to the stroke color)"
               i18n-aria-label aria-label="Fill Color"
               [class.cleared]="!style.fillColor"
               [value]="style.fillColor || ''"
               [disabled]="formControl.disabled"
               (input)="set('fillColor', $any($event.target).value)">
        <select class="geo-style-fill-style"
                i18n-title title="Fill Style"
                i18n-aria-label aria-label="Fill Style"
                [disabled]="formControl.disabled"
                (input)="set('fillStyle', $any($event.target).value)">
          @for (o of fillStyles; track o.value) {
            <option [value]="o.value" [selected]="o.value === (style.fillStyle || defaults.fillStyle)">{{ o.label }}</option>
          }
        </select>
        <button type="button" class="geo-style-fill-clear" (click)="clear('fillColor', 'fillStyle')" i18n-title title="Clear Fill" i18n>🆑️</button>
      </div>
    }
  `,
  styles: `
    .form-array {
      min-width: 0;
    }
    select,
    .range-input {
      flex: 1 1 0;
      min-width: 0;
    }
    :host .geo-style-stroke-label,
    :host .geo-style-stroke {
      margin-top: calc(4px + 1em);
    }
    .range-input {
      position: relative;
      display: flex;
      align-items: center;
      margin-left: 4px;
      margin-right: 4px;
    }
    .range-input input {
      flex: 1 1 0;
      min-width: 0;
    }
    .range-value {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      pointer-events: none;
    }
    input[type=color] {
      flex: 0 0 auto;
      width: 32px;
      min-width: 0;
    }
    button {
      flex: 0 0 auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FormlyFieldGeoStyle extends FieldType<FieldTypeConfig> {

  defaults = DEFAULTS;

  strokeWidths = labels(GEO_STROKE_WIDTHS, {
    small: $localize`Small`,
    medium: $localize`Medium`,
    large: $localize`Large`,
  });

  strokeStyles = labels(GEO_STROKE_STYLES, {
    solid: $localize`Solid`,
    dashed: $localize`Dashed`,
    dotted: $localize`Dotted`,
    blinking: $localize`Blinking`,
  });

  fillStyles = labels(GEO_FILL_STYLES, {
    default: $localize`Default Fill`,
    none: $localize`No Fill`,
    solid: $localize`Solid Fill`,
    ne: $localize`Hatched ↗️`,
    nw: $localize`Hatched ↖️`,
    crosshatch: $localize`Crosshatch`,
    blinking: $localize`Blinking Fill`,
  });

  get strokeWidthIndex() {
    return Math.max(0, GEO_STROKE_WIDTHS.indexOf(this.style.strokeWidth || DEFAULTS.strokeWidth!));
  }

  get strokeWidthLabel() {
    return $localize`Stroke Width: ${this.strokeWidths[this.strokeWidthIndex].label}`;
  }

  get fill() {
    return this.props.fill !== false;
  }

  get style(): GeoStyle {
    const v = this.formControl.value;
    return v && typeof v === 'object' ? v : {};
  }

  set(key: keyof GeoStyle, value: string) {
    const style: any = { ...this.style };
    if (!value || value === DEFAULTS[key]) {
      delete style[key];
    } else {
      style[key] = value;
    }
    this.update(style);
  }

  clear(...keys: (keyof GeoStyle)[]) {
    const style: any = { ...this.style };
    for (const key of keys) delete style[key];
    this.update(style);
  }

  private update(style: any) {
    this.formControl.setValue(Object.keys(style).length ? style : undefined);
    this.formControl.markAsDirty();
  }
}

function labels<T extends string>(values: readonly T[], names: Record<T, string>) {
  return values.map(value => ({ value, label: names[value] }));
}
