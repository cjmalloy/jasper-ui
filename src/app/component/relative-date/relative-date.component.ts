import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
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
   * Dragging the slider, until the hotkey is released.
   */
  readonly dragging = linkedSignal<boolean, boolean>({
    source: () => this.store.hotkey(),
    computation: (hotkey, previous) => hotkey && !!previous?.value,
  });

  /**
   * Holding the hotkey while dragging turns off snapping to presets.
   */
  readonly fine = computed(() => this.dragging() && this.store.hotkey());

  readonly label = computed(() => relativeDateLabel(presetAt(this.index())));

  release() {
    if (!this.store.hotkey()) this.dragging.set(false);
  }

  set() {
    // Snapped back if the hotkey was released while dragging
    const value = presetAt(this.fine() ? this.index() : Math.round(this.index()));
    if (value !== this.value()) this.changed.emit(value);
  }
}
