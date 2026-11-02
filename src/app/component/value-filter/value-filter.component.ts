import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { isEqual } from 'lodash-es';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminService } from '../../service/admin.service';
import { ValueFilterService } from '../../service/value-filter.service';
import { Store } from '../../store/store';
import { parseValueFilter } from '../../util/query';
import {
  formatAmount,
  humanAmount,
  parseAmount,
  rangeStops,
  splitAmount,
  unitValue,
  UNITS,
  valueUnit
} from '../../util/value-filter';

/**
 * Edit the value of a `{sort column}/before|after/{value}` filter,
 * with the input set by the mod filter config.
 */
@Component({
  selector: 'app-value-filter',
  templateUrl: './value-filter.component.html',
  styleUrls: ['./value-filter.component.scss'],
  host: { 'class': 'value-filter' },
})
export class ValueFilterComponent {
  private admin = inject(AdminService);
  private values = inject(ValueFilterService);
  private store = inject(Store);

  readonly filter = input.required<string>();
  /**
   * Query to find the range in, without filters.
   */
  readonly query = input('');
  readonly changed = output<string>();

  readonly parsed = computed(() => parseValueFilter(this.filter()));

  readonly config = computed(() => {
    const v = this.parsed();
    if (!v) return undefined;
    const configs = this.admin.filters().filter(f => f.sort === v.column);
    return configs.find(f => f[v.dir] !== undefined) || configs[0];
  });

  readonly unit = computed(() => {
    const v = this.parsed();
    return v && valueUnit(v.column, this.config());
  });

  readonly amount = computed(() => {
    const v = this.parsed();
    const unit = this.unit();
    return v && unit ? parseAmount(unit, v.value) : undefined;
  });

  /**
   * Values that can't be parsed fall back to text so they can be fixed.
   */
  readonly configInput = computed(() => this.amount() === undefined ? 'text' : this.config()?.input || 'text');

  /**
   * The text box being edited, so it stays after the hotkey is released.
   */
  readonly typing = signal(false);

  /**
   * Hold the hotkey to type any value, like an ISO duration, instead of using the slider.
   */
  readonly input = computed(() => this.configInput() === 'range' && (this.store.hotkey() || this.typing()) ? 'typed' : this.configInput());

  private readonly rangeParams = computed(() => this.configInput() === 'range'
    ? { column: this.parsed()!.column, unit: this.unit()!, query: this.query() }
    : undefined, { equal: isEqual });

  private readonly extent = rxResource({
    params: () => this.rangeParams(),
    stream: ({ params }) => this.values.extent(params.column, params.unit, params.query),
  });

  /**
   * Keep the previous range while a new query loads so the slider doesn't jump.
   */
  private readonly lastExtent = linkedSignal<(number | undefined)[], (number | undefined)[]>({
    source: () => this.extent.hasValue() ? this.extent.value() : [],
    computation: (current, previous) => current.length || !previous ? current : previous.value,
  });

  readonly stops = computed(() => {
    const [min, max] = this.lastExtent();
    return rangeStops(this.unit()!, this.amount(), min, max);
  });

  readonly index = linkedSignal(() => this.stops().indexOf(this.amount()!));

  readonly rangeLabel = computed(() => humanAmount(this.unit()!, this.stops()[this.index()]));

  readonly options = computed(() => UNITS[this.unit()!]);

  readonly split = computed(() => splitAmount(this.unit()!, this.amount()!));

  setTyped(input: HTMLInputElement) {
    this.typing.set(false);
    this.setText(input);
  }

  setText(input: HTMLInputElement) {
    const v = this.parsed()!;
    const value = input.value.trim();
    // Show the accepted value, since a rejected or trimmed edit leaves the filter (and the [value] binding) unchanged
    input.value = !value || value.includes('/') ? v.value : value;
    this.emit(input.value);
  }

  setRange() {
    this.emit(formatAmount(this.unit()!, this.stops()[this.index()]));
  }

  setNumber(input: HTMLInputElement) {
    const unit = this.unit()!;
    const text = input.value.trim();
    let value: string | undefined;
    if (/^\d+(\.\d+)?$/.test(text)) {
      value = unitValue(unit, Number(text), this.split().option);
    } else {
      // Shorthand like 10mb or 1h30m picks the unit
      const amount = parseAmount(unit, text);
      if (amount !== undefined) value = formatAmount(unit, amount);
    }
    if (!value) {
      input.value = String(this.split().number);
      return;
    }
    input.value = String(splitAmount(unit, parseAmount(unit, value)!).number);
    this.emit(value);
  }

  setUnit(suffix: string) {
    const option = this.options().find(o => o.suffix === suffix)!;
    this.emit(unitValue(this.unit()!, this.split().number, option));
  }

  private emit(value: string) {
    if (value !== this.parsed()!.value) this.changed.emit(value);
  }
}
