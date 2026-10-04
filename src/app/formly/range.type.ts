import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { isEqual } from 'lodash-es';
import { getErrorMessage } from './errors';

const MAX_TICKS = 30;
const MAX_NUMBERS = 12;

@Component({
  selector: 'formly-field-range',
  host: { 'class': 'field' },
  template: `
    <div class="range-input">
      @if (valueLabel; as label) {
        <div class="range-value">{{ label }}</div>
      }
      <input type="range"
             [min]="props.min"
             [max]="props.max"
             [step]="props.step"
             [attr.aria-valuetext]="valueLabel ? formControl.value + ' ' + valueLabel : null"
             (blur)="blur($any($event.target))"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
      @if (ticks.length) {
        <div class="range-ticks" aria-hidden="true">
          @for (t of ticks; track t.value) {
            <span class="range-tick"
                  [class.numbered]="t.numbered"
                  [style.left]="position(t.percent)"></span>
          }
        </div>
        <div class="range-numbers" aria-hidden="true">
          @for (t of ticks; track t.value) {
            @if (t.numbered) {
              <span class="range-number"
                    [class.active]="t.value === +formControl.value"
                    [style.left]="position(t.percent)">{{ t.value }}</span>
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    .range-input {
      --range-thumb: 16px;
      flex: 1;
      flex-basis: 100%;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .range-value {
      text-align: center;
    }
    input[type=range] {
      margin-left: 0;
      margin-right: 0;
    }
    .range-ticks,
    .range-numbers {
      position: relative;
    }
    .range-ticks {
      height: 6px;
    }
    .range-tick {
      position: absolute;
      top: 0;
      width: 1px;
      height: 3px;
      margin-left: -0.5px;
      background: currentColor;
      opacity: 0.4;
    }
    .range-tick.numbered {
      height: 6px;
      opacity: 0.7;
    }
    .range-numbers {
      height: 1.4em;
      font-size: 80%;
      opacity: 0.7;
    }
    .range-number {
      position: absolute;
      transform: translateX(-50%);
      white-space: nowrap;
      cursor: default;
    }
    .range-number.active {
      opacity: 1;
      font-weight: bold;
    }
  `,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldRange extends FieldType<FieldTypeConfig> {
  private config = inject(FormlyConfig);


  private showedError = false;
  private _labels?: { value: number, label: string }[];
  private _labelsFor?: any;
  private _ticks?: { value: number, percent: number, numbered: boolean }[];
  private _ticksFor?: any;

  /**
   * Human readable labels from props.labels, a map of value to label.
   * Each label applies from its value up to the next label.
   */
  get labels() {
    const key = this.props.labels;
    if (this._labels && isEqual(this._labelsFor, key)) return this._labels;
    this._labelsFor = key;
    return this._labels = Object.entries(this.props.labels || {})
      .map(([value, label]) => ({ value: +value, label: label as string }))
      .filter(l => isFinite(l.value))
      .sort((a, b) => a.value - b.value);
  }

  /**
   * Label for the current value, shown above the slider.
   */
  get valueLabel() {
    const value = +this.formControl.value;
    let label = '';
    for (const l of this.labels) {
      if (l.value > value) break;
      label = l.label;
    }
    return label;
  }

  /**
   * Tick marks under the slider, one per step when there are few enough steps.
   * Up to MAX_NUMBERS evenly spaced ticks are numbered.
   */
  get ticks() {
    const min = +(this.props.min ?? 0);
    const max = +(this.props.max ?? 100);
    const step = +(this.props.step || 1);
    const key = [min, max, step];
    if (this._ticks && isEqual(this._ticksFor, key)) return this._ticks;
    this._ticksFor = key;
    const count = Math.floor((max - min) / step + 1e-9);
    if (!(max > min) || !(step > 0) || count > MAX_TICKS) return this._ticks = [];
    const every = Math.ceil(count / (MAX_NUMBERS - 1)) || 1;
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      const value = +(min + i * step).toFixed(10);
      ticks.push({ value, percent: (value - min) / (max - min), numbered: i % every === 0 });
    }
    return this._ticks = ticks;
  }

  /**
   * Position under the centre of the slider thumb, which travels the width of
   * the slider minus the thumb width.
   */
  position(fraction: number) {
    return `calc(var(--range-thumb) / 2 + (100% - var(--range-thumb)) * ${fraction})`;
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
