/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { Store } from '../../store/store';
import { RelativeDateComponent } from './relative-date.component';

describe('RelativeDateComponent', () => {
  let fixture: ComponentFixture<RelativeDateComponent>;
  let changed: string[];

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  async function render(value: string) {
    fixture = TestBed.createComponent(RelativeDateComponent);
    fixture.componentRef.setInput('value', value);
    changed = [];
    fixture.componentInstance.changed.subscribe(v => changed.push(v));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the nearest preset', async () => {
    const el = await render('P1D');
    expect(el.querySelector<HTMLInputElement>('input')!.value).toBe('5');
    expect(el.querySelector('output')!.textContent).toBe('24 hours');
  });

  it('previews while sliding and sets on change', async () => {
    const el = await render('now');
    const range = el.querySelector<HTMLInputElement>('input')!;
    range.value = '2';
    range.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('output')!.textContent).toBe('15 minutes');
    expect(changed).toEqual([]);
    range.dispatchEvent(new Event('change'));
    expect(changed).toEqual(['PT15M']);
  });

  it('slides between presets while dragging with the hotkey', async () => {
    const el = await render('P3D');
    const range = el.querySelector<HTMLInputElement>('input')!;
    range.dispatchEvent(new Event('pointerdown'));
    TestBed.inject(Store).hotkey.set(true);
    await fixture.whenStable();
    expect(range.step).toBe('any');
    // Between 3 and 7 days
    range.value = '6.5';
    range.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('output')!.textContent).toBe('4 days, 14 hours');
    range.dispatchEvent(new Event('change'));
    expect(changed).toEqual(['P4DT14H']);
  });

  it('keeps the fine value when the hotkey is released while dragging', async () => {
    const el = await render('P3D');
    const range = el.querySelector<HTMLInputElement>('input')!;
    const store = TestBed.inject(Store);
    range.dispatchEvent(new Event('pointerdown'));
    store.hotkey.set(true);
    await fixture.whenStable();
    range.value = '6.5';
    range.dispatchEvent(new Event('input'));
    store.hotkey.set(false);
    await fixture.whenStable();
    store.hotkey.set(true);
    await fixture.whenStable();
    expect(fixture.componentInstance.fine()).toBe(true);
    store.hotkey.set(false);
    await fixture.whenStable();
    range.dispatchEvent(new Event('pointerup'));
    range.dispatchEvent(new Event('change'));
    expect(changed).toEqual(['P4DT14H']);
  });

  it('places a value between presets', async () => {
    const el = await render('P4DT14H');
    expect(el.querySelector('output')!.textContent).toBe('4 days, 14 hours');
    expect(fixture.componentInstance.index()).toBeCloseTo(6.5, 1);
  });

  it('shows a date input for timestamps', async () => {
    const el = await render('2025-01-02T03:04:00Z');
    expect(el.querySelector('input[type="range"]')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('input[type="datetime-local"]')!.value)
      .toBe(DateTime.fromISO('2025-01-02T03:04:00Z').toFormat("yyyy-MM-dd'T'T"));
  });

  it('switches a relative date to a timestamp with the hotkey', async () => {
    const el = await render('P1D');
    TestBed.inject(Store).hotkey.set(true);
    await fixture.whenStable();
    const date = el.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    expect(el.querySelector('input[type="range"]')).toBeNull();
    date.dispatchEvent(new Event('focus'));
    TestBed.inject(Store).hotkey.set(false);
    await fixture.whenStable();
    expect(el.querySelector('input[type="datetime-local"]')).toBe(date);
    date.value = '2025-01-02T03:04';
    date.dispatchEvent(new Event('change'));
    expect(changed).toEqual([DateTime.fromISO('2025-01-02T03:04').toISO()]);
  });

  it('waits for enter or blur when typing a date', async () => {
    const el = await render('2025-01-02T03:04:00Z');
    const date = el.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    date.dispatchEvent(new Event('focus'));
    date.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    date.value = '2024-01-02T03:04';
    date.dispatchEvent(new Event('change'));
    expect(changed).toEqual([]);
    date.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(changed).toEqual([DateTime.fromISO('2024-01-02T03:04').toISO()]);
  });

  it('switches a timestamp to a relative date with the hotkey', async () => {
    const el = await render('2025-01-02T03:04:00Z');
    TestBed.inject(Store).hotkey.set(true);
    await fixture.whenStable();
    expect(el.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(el.querySelector('input[type="range"]')).not.toBeNull();
  });

  it('keeps the slider while dragging with the hotkey', async () => {
    const el = await render('P1D');
    const range = el.querySelector<HTMLInputElement>('input')!;
    range.dispatchEvent(new Event('pointerdown'));
    TestBed.inject(Store).hotkey.set(true);
    await fixture.whenStable();
    expect(el.querySelector('input[type="range"]')).toBe(range);
  });
});
