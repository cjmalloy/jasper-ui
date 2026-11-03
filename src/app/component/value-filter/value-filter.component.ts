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
  roundAmount,
  splitAmount,
  stopAmount,
  stopIndex,
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
   * Dragging the slider, until the hotkey is released.
   */
  readonly dragging = linkedSignal<boolean, boolean>({
    source: () => this.store.hotkey(),
    computation: (hotkey, previous) => hotkey && !!previous?.value,
  });

  /**
   * Holding the hotkey while dragging turns off snapping to stops.
   */
  readonly fine = computed(() => this.dragging() && this.store.hotkey());

  /**
   * Hold the hotkey to type any value instead of using the slider,
   * like an ISO duration in a text box, or a number and unit.
   */
  readonly input = computed(() => {
    const input = this.configInput();
    if (input !== 'range' || this.dragging() || !this.store.hotkey() && !this.typing()) return input;
    return this.config()?.hotkeyInput === 'units' ? 'units' : 'typed';
  });

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

  /**
   * Amount being dragged to, kept in the stops if a new range loads mid-drag.
   */
  private readonly preview = linkedSignal<number | undefined, number | undefined>({
    source: () => this.amount(),
    computation: () => undefined,
  });

  readonly stops = computed(() => {
    const [min, max] = this.lastExtent();
    const stops = rangeStops(this.unit()!, this.amount(), min, max);
    const preview = this.preview();
    if (preview === undefined || stops.includes(preview)) return stops;
    if (preview > stops[0] && preview < stops[stops.length - 1]) return stops;
    return [...stops, preview].sort((a, b) => a - b);
  }, { equal: isEqual });

  /**
   * Slider position. Keeps an uncommitted preview when only the stops change, such as when the range loads mid-drag.
   */
  readonly index = linkedSignal<{ stops: number[], amount?: number }, number>({
    source: () => ({ stops: this.stops(), amount: this.amount() }),
    computation: ({ stops, amount }, previous) => {
      if (previous && previous.source.amount === amount && previous.value !== stopIndex(previous.source.stops, amount!)) {
        return stopIndex(stops, this.amountAt(previous.value, previous.source.stops));
      }
      return stopIndex(stops, amount!);
    },
  });

  readonly rangeLabel = computed(() => humanAmount(this.unit()!, this.amountAt(this.index())));

  readonly options = computed(() => UNITS[this.unit()!]);

  readonly split = computed(() => splitAmount(this.unit()!, this.amount()!));

  setTyped(input: HTMLInputElement) {
    this.typing.set(false);
    this.setText(input);
  }

  setText(input: HTMLInputElement) {
    const v = this.parsed()!;
    const value = input.value.trim();
    // The server rejects '/', ',' and '->' in values.
    // Show the accepted value, since a rejected or trimmed edit leaves the filter (and the [value] binding) unchanged
    input.value = !value || /\/|,|->/.test(value) ? v.value : value;
    this.emit(input.value);
  }

  drag(index: number) {
    this.index.set(index);
    this.preview.set(this.amountAt(index));
  }

  release() {
    if (!this.store.hotkey()) this.dragging.set(false);
  }

  setRange() {
    // Snapped back if the hotkey was released while dragging
    const index = this.fine() ? this.index() : Math.round(this.index());
    this.emit(formatAmount(this.unit()!, this.amountAt(index)));
  }

  private amountAt(index: number, stops = this.stops()) {
    if (Number.isInteger(index)) return stops[index];
    return roundAmount(this.unit()!, stopAmount(stops, index));
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
