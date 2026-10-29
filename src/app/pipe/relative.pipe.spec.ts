/// <reference types="vitest/globals" />
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DateTime } from 'luxon';
import { ClockService } from '../service/clock.service';
import { RelativePipe } from './relative.pipe';

describe('RelativePipe', () => {
  const now = DateTime.fromISO('2024-01-01T12:00:00Z');
  let pipe: RelativePipe;

  beforeEach(() => {
    const clock = { now: signal(now) } as unknown as ClockService;
    TestBed.configureTestingModule({
      providers: [
        { provide: ClockService, useValue: clock },
      ],
    });
    pipe = TestBed.runInInjectionContext(() => new RelativePipe());
  });

  it('formats against the clock', () => {
    expect(pipe.transform(now.minus({ minutes: 5 }))).toBe('5 minutes ago');
  });

  it('treats times just after the last tick as now', () => {
    expect(pipe.transform(now.plus({ seconds: 3 }))).toBe('0 seconds ago');
  });

  it('keeps future times', () => {
    expect(pipe.transform(now.plus({ hours: 2 }))).toBe('in 2 hours');
  });

  it('handles missing values', () => {
    expect(pipe.transform(undefined)).toBe('');
  });
});
