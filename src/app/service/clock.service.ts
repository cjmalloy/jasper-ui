import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';

/**
 * Shared wall clock for relative times in templates. Reading the system time during
 * rendering would change between change detection and the checkNoChanges pass.
 */
@Injectable({
  providedIn: 'root'
})
export class ClockService {
  static readonly TICK_MS = 10_000;

  /** Current time, updated every {@link ClockService.TICK_MS}. */
  readonly now = signal(DateTime.now());

  private readonly timer = setInterval(() => this.now.set(DateTime.now()), ClockService.TICK_MS);
  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
}
