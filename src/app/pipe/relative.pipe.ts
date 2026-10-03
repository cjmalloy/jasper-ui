import { Pipe, PipeTransform } from '@angular/core';
import { DateTime } from 'luxon';
import { ClockService } from '../service/clock.service';

/**
 * Relative time ("5 minutes ago") against {@link ClockService.now}, so it is stable
 * within a render and refreshes when the clock ticks.
 */
@Pipe({
  name: 'relative',
  pure: false,
})
export class RelativePipe implements PipeTransform {

  constructor(
    private clock: ClockService,
  ) { }

  transform(value?: DateTime | null): string {
    if (!value?.isValid) return '';
    const now = this.clock.now();
    // Times slightly ahead of the last tick are just new, not in the future
    const base = value >= now && value.diff(now).as('milliseconds') < ClockService.TICK_MS * 2 ? value.plus(1) : now;
    return value.toRelative({ base }) ?? '';
  }

}
