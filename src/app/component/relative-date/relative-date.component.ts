import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Duration } from 'luxon';
import { Store } from '../../store/store';
import { DATE_PRESETS, relativeDate, relativeDateLabel } from '../../util/query';
import { roundSeconds, stopAmount, stopIndex } from '../../util/value-filter';

const PRESET_SECONDS = DATE_PRESETS.map(p => p === 'now' ? 0 : Duration.fromISO(p).as('seconds'));

function presetAt(index: number) {
  if (Number.isInteger(index)) return DATE_PRESETS[index];
  const seconds = stopAmount(PRESET_SECONDS, index);
  return seconds < 1 ? 'now' : roundSeconds(seconds).toISO()!;
}

/**
 * Slider for a date filter relative to now, like `now` or `P1D`.
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

  readonly index = linkedSignal(() => {
    const value = this.value();
    if (value.toLowerCase() === 'now' || !relativeDate(value)) return 0;
    return stopIndex(PRESET_SECONDS, Duration.fromISO(value.toUpperCase()).as('seconds'));
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

  readonly label = computed(() => relativeDateLabel(presetAt(this.index())));

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
  }

  set() {
    const value = presetAt(this.index());
    if (value !== this.value()) this.changed.emit(value);
  }
}
