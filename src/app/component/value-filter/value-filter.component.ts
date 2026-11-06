import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { isEqual } from 'lodash-es';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminService } from '../../service/admin.service';
import { ValueFilterService } from '../../service/value-filter.service';
import { Store } from '../../store/store';
import { parseValueFilter } from '../../util/query';
import {
  formatAmount,
  formOptions,
  humanAmount,
  parseAmount,
  rangeStops,
  roundAmount,
  splitAmount,
  stopAmount,
  stopIndex,
  unitValue,
  UNITS,
  validFilterValue,
  valueUnit
} from '../../util/value-filter';

/**
 * Edit the value of a `{sort column}/before|after|equals/{value}` filter,
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
    if (v.dir === 'equals') return this.admin.filters().find(f => f.field === v.column);
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
   * Options of the select input, from the filter config or the plugin form field.
   */
  private readonly selectOptions = computed(() => {
    const v = this.parsed();
    if (!v || this.config()?.input !== 'select') return [];
    const config = this.config()?.options;
    const options = config?.length ? config : formOptions(this.admin.getPlugin(v.column.substring('plugins->'.length).split('->')[0]), v.column);
    return options.filter(o => validFilterValue(o.value));
  }, { equal: isEqual });

  /**
   * Select options, plus the current value if it isn't one of them so it can be shown.
   */
  readonly choices = computed(() => {
    const value = this.parsed()?.value;
    const options = this.selectOptions().map(o => ({ value: o.value, label: o.label || o.value }));
    if (value === undefined || options.some(o => o.value === value)) return options;
    return [...options, { value, label: value }];
  }, { equal: isEqual });

  /**
   * Values that can't be parsed fall back to text so they can be fixed.
   */
  readonly configInput = computed(() => {
    if (this.config()?.input === 'select') return this.selectOptions().length ? 'select' : 'text';
    return this.amount() === undefined ? 'text' : this.config()?.input || 'text';
  });

  /**
   * The text box being edited, so it stays after the hotkey is released.
   */
  readonly typing = signal(false);

  /**
   * The pointer is down on the slider.
   */
  private readonly pressed = signal(false);

  /**
   * Keeps the slider after it is released with the hotkey held, until the hotkey is released.
   */
  private readonly kept = linkedSignal<boolean, boolean>({
    source: () => this.store.hotkey(),
    computation: (hotkey, previous) => hotkey && !!previous?.value,
  });

  /**
   * Dragging the slider. Pressing or releasing the hotkey mid-drag keeps dragging.
   */
  readonly dragging = computed(() => this.pressed() || this.kept());

  /**
   * Holding the hotkey while dragging turns off snapping to stops.
   */
  readonly fine = computed(() => this.dragging() && this.store.hotkey());

  /**
   * Fine tuned during this drag, so releasing the hotkey keeps the fine value instead of snapping back.
   */
  readonly tuned = signal(false);

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
    // Show the accepted value, since a rejected or trimmed edit leaves the filter (and the [value] binding) unchanged
    input.value = validFilterValue(value) ? value : v.value;
    this.emit(input.value);
  }

  press() {
    this.pressed.set(true);
    this.tuned.set(false);
  }

  release() {
    this.pressed.set(false);
    this.kept.set(this.store.hotkey());
  }

  drag(index: number) {
    if (this.fine()) this.tuned.set(true);
    this.index.set(index);
    this.preview.set(this.amountAt(index));
  }

  setRange() {
    this.emit(formatAmount(this.unit()!, this.amountAt(this.index())));
  }

  private amountAt(index: number, stops = this.stops()) {
    if (Number.isInteger(index)) return stops[index];
    return roundAmount(this.unit()!, stopAmount(stops, index));
  }

  setOption(value: string) {
    this.emit(value);
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
