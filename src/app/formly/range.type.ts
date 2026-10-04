import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { isEqual } from 'lodash-es';
import { getErrorMessage } from './errors';

const MAX_TICKS = 30;

@Component({
  selector: 'formly-field-range',
  host: { 'class': 'field' },
  template: `
    <div class="range-input">
      <input type="range"
             [min]="props.min"
             [max]="props.max"
             [step]="props.step"
             [attr.list]="labels.length ? field.id + '-labels' : null"
             (blur)="blur($any($event.target))"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
      @if (ticks.length) {
        <div class="range-ticks" aria-hidden="true">
          @for (t of ticks; track t.value) {
            <span class="range-tick"
                  [class.labeled]="t.labeled"
                  [style.left.%]="t.percent"></span>
          }
        </div>
      }
      @if (labels.length) {
        <datalist [id]="field.id + '-labels'">
          @for (l of labels; track l.value) {
            <option [value]="l.value" [label]="l.label"></option>
          }
        </datalist>
        <div class="range-labels" aria-hidden="true">
          @for (l of labels; track l.value) {
            <span class="range-label"
                  [class.active]="l.value === formControl.value"
                  [class.start]="l.percent === 0"
                  [class.end]="l.percent === 100"
                  [style.left.%]="l.percent">{{ l.label }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .range-input {
      flex: 1;
      flex-basis: 100%;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .range-ticks {
      position: relative;
      height: 6px;
      margin: 0 8px;
    }
    .range-tick {
      position: absolute;
      top: 0;
      width: 1px;
      height: 3px;
      background: currentColor;
      opacity: 0.4;
    }
    .range-tick.labeled {
      height: 6px;
      opacity: 0.7;
    }
    .range-labels {
      position: relative;
      height: 1.4em;
      margin: 0 8px;
      font-size: 80%;
      opacity: 0.7;
    }
    .range-label {
      position: absolute;
      transform: translateX(-50%);
      white-space: nowrap;
      cursor: default;
    }
    .range-label.start {
      transform: none;
    }
    .range-label.end {
      transform: translateX(-100%);
    }
    .range-label.active {
      opacity: 1;
      font-weight: bold;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldRange extends FieldType<FieldTypeConfig> {

  private showedError = false;
  private _labels?: { value: number, label: string, percent: number }[];
  private _labelsFor?: any;
  private _ticks?: { value: number, percent: number, labeled: boolean }[];
  private _ticksFor?: any;

  constructor(
    private config: FormlyConfig,
  ) {
    super();
  }

  /**
   * Labels shown under the slider from props.labels, a map of value to label.
   */
  get labels() {
    const min = this.props.min ?? 0;
    const max = this.props.max ?? 10;
    const key = [this.props.labels, min, max];
    if (this._labels && isEqual(this._labelsFor, key)) return this._labels;
    this._labelsFor = key;
    return this._labels = Object.entries(this.props.labels || {})
      .map(([value, label]) => ({ value: +value, label: label as string }))
      .filter(l => isFinite(l.value) && l.value >= min && l.value <= max)
      .sort((a, b) => a.value - b.value)
      .map(l => ({ ...l, percent: max > min ? 100 * (l.value - min) / (max - min) : 0 }));
  }

  /**
   * Tick marks under the slider, one per step when there are few enough steps,
   * otherwise only at the labeled values.
   */
  get ticks() {
    const min = this.props.min ?? 0;
    const max = this.props.max ?? 10;
    const step = this.props.step || 1;
    const labels = this.labels;
    const key = [labels, min, max, step];
    if (this._ticks && isEqual(this._ticksFor, key)) return this._ticks;
    this._ticksFor = key;
    const labeled = new Set(labels.map(l => l.value));
    const values = new Set(labeled);
    const count = (max - min) / step;
    if (max > min && step > 0 && count <= MAX_TICKS) {
      for (let i = 0; i <= count; i++) values.add(min + i * step);
    }
    return this._ticks = [...values]
      .sort((a, b) => a - b)
      .map(value => ({ value, labeled: labeled.has(value), percent: max > min ? 100 * (value - min) / (max - min) : 0 }));
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
