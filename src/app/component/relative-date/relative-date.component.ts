import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { DATE_PRESETS, relativeDateLabel, relativeDatePreset } from '../../util/query';

/**
 * Slider for a date filter relative to now, like `now` or `P1D`.
 */
@Component({
  selector: 'app-relative-date',
  templateUrl: './relative-date.component.html',
  styleUrls: ['./relative-date.component.scss'],
  host: { 'class': 'relative-date' },
})
export class RelativeDateComponent {
  readonly value = input.required<string>();
  readonly changed = output<string>();

  readonly presets = DATE_PRESETS;

  readonly index = linkedSignal(() => relativeDatePreset(this.value()));

  readonly label = computed(() => relativeDateLabel(this.presets[this.index()]));

  set() {
    const value = this.presets[this.index()];
    if (value !== this.value()) this.changed.emit(value);
  }
}
