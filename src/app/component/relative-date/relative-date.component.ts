import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DateTime, Duration } from 'luxon';
import { Store } from '../../store/store';
import { DATE_PRESETS, dateTimeLocal, relativeDate, relativeDateLabel } from '../../util/query';
import { roundSeconds, stopAmount, stopIndex } from '../../util/value-filter';

const PRESET_SECONDS = DATE_PRESETS.map(p => p === 'now' ? 0 : Duration.fromISO(p).as('seconds'));

const MODIFIERS = ['Control', 'Meta', 'Shift', 'Alt'];

function presetAt(index: number) {
  if (Number.isInteger(index)) return DATE_PRESETS[index];
  const seconds = stopAmount(PRESET_SECONDS, index);
  return seconds < 1 ? 'now' : roundSeconds(seconds).toISO()!;
}

/**
 * Edit the value of a date filter.
 * Relative dates like `now` or `P1D` use a slider, and timestamps use a date input.
 * Hold the hotkey to switch between them.
 * Holding the hotkey while dragging slides between the presets.
 */
@Component({
  selector: 'app-relative-date',
  templateUrl: './relative-date.component.html',
  styleUrls: ['./relative-date.component.scss'],
  host: { 'class': 'relative-date' },
})
export class RelativeDateComponent {
  private store = inject(Store);

  readonly value = input.required<string>();
  readonly changed = output<string>();

  readonly max = DATE_PRESETS.length - 1;

  readonly relative = computed(() => relativeDate(this.value()));

  /**
   * Date input value. A relative date is measured from when the date input is shown.
   */
  readonly date = computed(() => this.range() ? '' : dateTimeLocal(this.value()));

  /**
   * The date input being edited, so it stays after the hotkey is released.
   * A new value means the edit is done, even if the date input was removed without a blur.
   */
  readonly typing = linkedSignal({
    source: () => this.value(),
    computation: () => false,
  });

  /**
   * The date was picked rather than typed, so it can be set right away.
   */
  private picked = false;

  /**
   * Last value set from the slider, so releasing and the change event don't both set it.
   */
  private readonly emitted = linkedSignal<string, string | undefined>({
    source: () => this.value(),
    computation: () => undefined,
  });

  /**
   * Slider position. A timestamp is placed by how long ago it was, so sliding to `now` changes it.
   */
  readonly index = linkedSignal(() => {
    const value = this.value();
    if (value.toLowerCase() === 'now') return 0;
    if (relativeDate(value)) return stopIndex(PRESET_SECONDS, Duration.fromISO(value.toUpperCase()).as('seconds'));
    const date = DateTime.fromISO(value);
    if (!date.isValid) return 0;
    return stopIndex(PRESET_SECONDS, -date.diffNow('seconds').seconds);
  });

  /**
   * The pointer is down on the slider.
   */
  private readonly pressed = signal(false);

  /**
   * Keeps dragging after the slider is released with the hotkey held, until the hotkey is released.
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
   * Holding the hotkey while dragging turns off snapping to presets.
   */
  readonly fine = computed(() => this.dragging() && this.store.hotkey());

  /**
   * Fine tuned during this drag, so releasing the hotkey keeps the fine value instead of snapping back.
   */
  readonly tuned = signal(false);

  /**
   * Show the slider. Hold the hotkey to switch between the slider and the date input.
   */
  readonly range = computed(() => {
    if (this.dragging()) return true;
    if (this.relative() && this.typing()) return false;
    return this.relative() !== this.store.hotkey();
  });

  /**
   * The slider was moved from a timestamp, such as with the keyboard.
   */
  readonly moved = linkedSignal({
    source: () => this.value(),
    computation: () => false,
  });

  /**
   * Show the label for a relative date, even in the date input, so holding the hotkey doesn't shift the layout.
   * A timestamp waits until the slider is used.
   */
  readonly showLabel = computed(() => this.relative() || this.dragging() || this.moved());

  readonly label = computed(() => relativeDateLabel(presetAt(this.index())));

  press() {
    this.pressed.set(true);
    this.tuned.set(false);
  }

  release(range?: HTMLInputElement) {
    this.pressed.set(false);
    this.kept.set(this.store.hotkey());
    // Sliding a timestamp to where the slider snapped it doesn't fire a change event
    if (!range || this.relative()) return;
    this.index.set(+range.value);
    this.set();
  }

  drag(index: number) {
    this.moved.set(true);
    if (this.fine()) this.tuned.set(true);
    this.index.set(index);
  }

  set() {
    // Keep the slider while adjusting it with the keyboard and the hotkey held
    this.kept.set(this.store.hotkey());
    const value = presetAt(this.index());
    if (value === this.value() || value === this.emitted()) return;
    this.emitted.set(value);
    this.changed.emit(value);
  }

  focus() {
    this.typing.set(true);
    this.picked = true;
  }

  keydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      // Enter converts a relative date to the timestamp shown
      this.setDate(event.target as HTMLInputElement, this.relative());
    } else if (!MODIFIERS.includes(event.key)) {
      this.picked = false;
    }
  }

  pick(input: HTMLInputElement) {
    if (this.picked) this.setDate(input);
  }

  blur(input: HTMLInputElement) {
    this.typing.set(false);
    this.setDate(input);
  }

  private setDate(input: HTMLInputElement, convert = false) {
    if (!input.value) return;
    const date = DateTime.fromISO(input.value);
    if (!date.isValid) return;
    if (convert || input.value !== this.date()) this.changed.emit(date.toISO()!);
  }
}
